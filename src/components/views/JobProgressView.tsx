'use client';

import { FileText, Loader2, RotateCw, AlertTriangle, ArrowLeft } from 'lucide-react';
import React from 'react';
import { AgenticWorkflowStepper } from '@/components/AgenticWorkflowStepper';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';

interface JobProgressViewProps {
  job:
    | DossierJob
    | {
        id: string;
        status:
          | typeof JOB_STATUS.PENDING
          | typeof JOB_STATUS.PROCESSING
          | typeof JOB_STATUS.COMPLETED
          | typeof JOB_STATUS.FAILED;
        stage?:
          | typeof JOB_STAGES.QUEUED
          | typeof JOB_STAGES.PAGE_SPLITTING
          | typeof JOB_STAGES.EXTRACTION
          | typeof JOB_STAGES.AUDITING
          | typeof JOB_STAGES.PERSISTING;
        progressDetails?: {
          currentStep?: number;
          totalSteps?: number;
          currentActivity?: string;
          processedUnits?: number;
          totalUnits?: number;
        };
        payload: {
          caseType: string;
          notes?: string;
          files: Array<{ name: string; size: number }>;
        };
        errorMessage?: string;
      };
  onBackToTable: () => void;
  onRetryJob?: (jobId: string) => Promise<boolean | void>;
  isRetrying?: boolean;
}

export const JobProgressView: React.FC<JobProgressViewProps> = ({
  job,
  onBackToTable,
  onRetryJob,
  isRetrying = false,
}) => {
  // Map job stage to stepper activeStep (1, 2, or 3)
  const activeStep: 1 | 2 | 3 =
    job.stage === JOB_STAGES.AUDITING ? 2 : job.stage === JOB_STAGES.PERSISTING ? 3 : 1;

  const currentActivity =
    job.progressDetails?.currentActivity ||
    (job.status === JOB_STATUS.PENDING
      ? 'In der Kanzlei-Warteschlange eingereiht...'
      : 'Dokumente werden geprüft...');

  const caseTitle = job.payload.notes ? job.payload.notes.slice(0, 60) : 'Neuer Urkundenvorgang';
  const fileCount = job.payload.files.length;

  return (
    <section className="animate-in fade-in space-y-3 duration-300">
      {/* Action Bar oben mit Vorgangsname, Status und Stand - 1:1 identisch zu DossierDetailView */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2.5 border-b pb-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
            {caseTitle}
          </h2>
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} size="sm" />
            <span className="text-muted-foreground text-xs">
              {job.status === JOB_STATUS.PROCESSING ? 'Live-Prüfung aktiv' : 'In Warteschlange'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onBackToTable}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Zur Übersicht</span>
          </Button>
        </div>
      </div>

      {/* Fehlermeldung & Retry-Aktion bei FAILED */}
      {job.status === JOB_STATUS.FAILED && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive space-y-3 rounded-xl border p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Prüflauf fehlgeschlagen</h3>
              <p className="text-sm opacity-90">
                {job.errorMessage ||
                  'Ein unerwarteter Fehler ist während der Hintergrundanalyse aufgetreten.'}
              </p>
            </div>
          </div>
          {onRetryJob && (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRetrying}
                onClick={() => onRetryJob(job.id)}
                className="border-destructive/40 text-destructive hover:bg-destructive/20 gap-2"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="h-4 w-4" />
                )}
                <span>Prüfung wiederholen</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Großer prominenter AgenticWorkflowStepper */}
      <AgenticWorkflowStepper
        isAnalyzing={job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.PROCESSING}
        activeStep={activeStep}
        stepDetail={currentActivity}
      />

      {/* Übersicht der hochgeladenen Dokumente */}
      {fileCount > 0 && (
        <div className="bg-card border-border space-y-3 rounded-xl border p-5 shadow-xs">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Eingereichte Dokumente ({fileCount})
          </h3>
          <ul className="divide-border border-border bg-muted/20 divide-y rounded-lg border">
            {job.payload.files.map((file, idx) => (
              <li key={idx} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-foreground font-medium">{file.name}</span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  {Math.round(file.size / 1024)} KB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
