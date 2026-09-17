import { startWorkerDaemon } from '../src/lib/jobs/job-daemon';

console.info('====================================================');
console.info('Notar Agent Queue Worker Daemon gestartet');
console.info('Überwacht PENDING Jobs & Orphan Sweeper aktiv');
console.info('Beenden mit Ctrl+C (Graceful Shutdown SIGINT/SIGTERM)');
console.info('====================================================');

const daemon = startWorkerDaemon({
  pollIntervalMs: 2000,
  sweepIntervalMs: 30000,
  leaseTimeoutMs: 5 * 60 * 1000,
  autoRegisterSignals: true,
});

// Prozess am Leben halten
setInterval(() => {
  if (!daemon.isRunning()) {
    process.exit(0);
  }
}, 5000);
