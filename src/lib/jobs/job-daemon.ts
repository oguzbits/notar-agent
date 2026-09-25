import { IJobRepository } from '@/lib/jobs/job-repository';
import { executeDossierJob, WorkerDependencies } from '@/lib/jobs/job-worker';
import { getJobRepository, getDossierRepository } from '@/lib/supabase/server';
import { DossierJob } from '@/types/jobs';

export interface WorkerDaemonOptions {
  jobRepo?: IJobRepository;
  deps?: WorkerDependencies;
  pollIntervalMs?: number;
  sweepIntervalMs?: number;
  leaseTimeoutMs?: number;
  autoRegisterSignals?: boolean;
}

export interface WorkerDaemonHandle {
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getActiveJobCount: () => number;
}

/**
 * Startet einen entkoppelten Worker-Daemon (Polling Runner & Zombie-Sweeper).
 * - Periodisches Polling nach PENDING Jobs via claimNextPendingJob()
 * - Periodischer Sweep nach verwaisten PROCESSING Jobs via recoverOrphanJobs()
 * - Graceful Shutdown bei SIGTERM/SIGINT:
 *   - Stoppt Annahme neuer Jobs
 *   - Signalisiert AbortController an laufende Jobs
 *   - Wartet auf Rückkehr oder stellt Status geordnet auf PENDING zurück
 */
export function startWorkerDaemon(options: WorkerDaemonOptions = {}): WorkerDaemonHandle {
  const jobRepo = options.jobRepo ?? getJobRepository();
  const dossierRepo = options.deps?.dossierRepo ?? getDossierRepository();
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const sweepIntervalMs = options.sweepIntervalMs ?? 30000;
  const leaseTimeoutMs = options.leaseTimeoutMs ?? 5 * 60 * 1000;
  const autoRegisterSignals = options.autoRegisterSignals ?? typeof process !== 'undefined';

  let running = true;
  let activeJobs = 0;
  const abortController = new AbortController();

  let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let sweepIntervalId: ReturnType<typeof setInterval> | null = null;

  const runSweep = async () => {
    try {
      const recovered = await jobRepo.recoverOrphanJobs(leaseTimeoutMs);
      if (recovered.length > 0) {
        console.info(`[WorkerDaemon] ${recovered.length} verwaiste Jobs reaktiviert/behandelt.`);
      }
    } catch (err) {
      console.warn('[WorkerDaemon] Fehler beim Zombie-Sweeper:', err);
    }
  };

  const pollNext = async () => {
    if (!running || abortController.signal.aborted) {
      return;
    }

    try {
      const job: DossierJob | null = await jobRepo.claimNextPendingJob();
      if (job) {
        activeJobs++;
        // Asynchrone Ausführung des geclaimten Jobs
        void executeDossierJob(job.id, {
          jobRepo,
          dossierRepo,
          pipelineFn: options.deps?.pipelineFn,
          abortSignal: abortController.signal,
        })
          .catch((err) => {
            console.error('[WorkerDaemon] Unerwarteter Fehler bei Job:', job.id, err);
          })
          .finally(() => {
            activeJobs = Math.max(0, activeJobs - 1);
            // Sofort nach dem nächsten Job suchen
            if (running && !abortController.signal.aborted) {
              setImmediate(pollNext);
            }
          });
      }
    } catch (err) {
      console.warn('[WorkerDaemon] Fehler beim Abrufen des nächsten Jobs:', err);
    }

    if (running && !abortController.signal.aborted) {
      pollTimeoutId = setTimeout(pollNext, pollIntervalMs);
    }
  };

  // Initialer Sweep + Start Polling
  void runSweep();
  sweepIntervalId = setInterval(() => void runSweep(), sweepIntervalMs);
  pollTimeoutId = setTimeout(pollNext, 100);

  const stop = async (): Promise<void> => {
    if (!running) return;
    running = false;
    abortController.abort();

    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
    if (sweepIntervalId) {
      clearInterval(sweepIntervalId);
      sweepIntervalId = null;
    }

    // Warte maximal 5 Sekunden auf Beendigung aktiver Jobs
    const startWait = Date.now();
    while (activeJobs > 0 && Date.now() - startWait < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  // Signal-Listener für graceful process shutdown
  if (autoRegisterSignals && typeof process !== 'undefined' && typeof process.on === 'function') {
    const signalHandler = () => {
      console.info('[WorkerDaemon] Signal empfangen, fahre Worker herunter...');
      void stop().then(() => {
        console.info('[WorkerDaemon] Worker erfolgreich beendet.');
      });
    };

    process.once('SIGTERM', signalHandler);
    process.once('SIGINT', signalHandler);
  }

  return {
    stop,
    isRunning: () => running,
    getActiveJobCount: () => activeJobs,
  };
}
