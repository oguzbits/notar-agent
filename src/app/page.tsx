'use client';

import { Loader2, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { DocumentTable } from '@/components/DocumentTable';
import { Header } from '@/components/Header';
import { DossierDetailView } from '@/components/views/DossierDetailView';
import { JobProgressView } from '@/components/views/JobProgressView';
import { NewVorgangUploadView } from '@/components/views/NewVorgangUploadView';
import { useAnalysisWorkflow } from '@/hooks/useAnalysisWorkflow';
import { useDocuments } from '@/hooks/useDocuments';
import { useJobs } from '@/hooks/useJobs';
import { useVorgangSession } from '@/hooks/useVorgangSession';
import { normalizeDossier } from '@/lib/dossier';
import { DocumentRecord } from '@/lib/supabase/server';
import {
  FieldStatus,
  getDossierFieldsRecord,
  updateDossierFieldStatus,
  STORAGE_TYPES,
} from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';

const VIEW_MODE = {
  TABLE: 'table',
  UPLOAD: 'upload',
  DETAIL: 'detail',
  JOB: 'job',
} as const;

type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vorgangParam = searchParams.get('vorgang');
  const jobParam = searchParams.get('job');
  const viewParam = searchParams.get('view');

  const { documents, isLoadingDocs, loadDocuments, deleteDocument, updateDossier } = useDocuments();
  const { jobs, activeJobs, failedJobs, retryJob, isRetrying, loadJobs } = useJobs();
  const {
    isAnalyzing,
    activeStep,
    stepDetail,
    errorMessage,
    setErrorMessage,
    startAsyncAnalysis,
    startAppendAnalysis,
  } = useAnalysisWorkflow();
  const { state: session, actions } = useVorgangSession();

  // Selektierten Job bzw. Datensatz auflösen
  const activeJobFromQuery = jobParam ? jobs.find((j) => j.id === jobParam) : null;
  const activeJob =
    activeJobFromQuery ||
    (jobParam
      ? {
          id: jobParam,
          status: JOB_STATUS.PENDING,
          stage: JOB_STAGES.QUEUED,
          progressDetails: {
            currentStep: 1,
            totalSteps: 4,
            currentActivity: 'In der Kanzlei-Warteschlange eingereiht...',
          },
          payload: {
            caseType: session.caseType,
            notes: session.notes,
            files: session.files.map((f) => ({ name: f.name, size: f.size })),
          },
        }
      : null);

  // Wenn der aufgerufene Job fertiggestellt wurde, direkt auf das erzeugte Vorgangs-Dossier weiterleiten (im Effect, nicht während des Render-Durchlaufs)
  const completedDossierId = activeJobFromQuery?.resultDossierId;
  useEffect(() => {
    if (completedDossierId && vorgangParam !== completedDossierId) {
      router.replace(`/?vorgang=${encodeURIComponent(completedDossierId)}`);
    }
  }, [completedDossierId, vorgangParam, router]);

  const activeRecord = vorgangParam ? documents.find((d) => d.id === vorgangParam) : null;
  const rawDisplayedDossier = activeRecord?.content || session.dossier;
  const displayedDossier = rawDisplayedDossier ? normalizeDossier(rawDisplayedDossier) : null;

  const effectiveView: ViewMode =
    vorgangParam && displayedDossier
      ? VIEW_MODE.DETAIL
      : jobParam && activeJob
        ? VIEW_MODE.JOB
        : viewParam === VIEW_MODE.UPLOAD
          ? VIEW_MODE.UPLOAD
          : VIEW_MODE.TABLE;

  // Navigation Aktionen
  const handleSelectDocument = (doc: DocumentRecord) => {
    if (doc.content) {
      setErrorMessage(null);
      actions.selectDocument(doc.id, doc.content, doc.title);
      router.push(`/?vorgang=${encodeURIComponent(doc.id)}`);
    }
  };

  const handleSelectJob = (job: DossierJob) => {
    setErrorMessage(null);
    router.push(`/?job=${encodeURIComponent(job.id)}`);
  };

  const handleCreateNew = () => {
    actions.resetNewVorgang();
    setErrorMessage(null);
    router.push('/?view=upload');
  };

  const handleBackToTable = () => {
    actions.resetNewVorgang();
    setErrorMessage(null);
    router.push('/');
  };

  // Analyse-Trigger: Erzeugt sofort den Vorgang und navigiert unterbrechungsfrei in die Vorgangsansicht
  const handleStartAnalysis = async () => {
    try {
      await startAsyncAnalysis(session.files, session.caseType, session.notes, (jobId) => {
        loadJobs();
        router.push(`/?job=${encodeURIComponent(jobId)}`);
      });
    } catch (err) {
      console.error('Analyse Start fehlgeschlagen:', err);
    }
  };

  const handleStartAppendAnalysis = async () => {
    if (!displayedDossier) return;
    try {
      await startAppendAnalysis(
        session.activeDocumentId || vorgangParam,
        displayedDossier,
        session.appendFiles,
        session.appendNotes,
        (result) => {
          actions.setDossier(result.dossier);
          actions.resetAppend();
        }
      );
      loadDocuments();
    } catch (err) {
      console.error('Nachreich-Analyse fehlgeschlagen:', err);
    }
  };

  // Aktiver Transaktionszustand für notarielle Feld-Overrides
  const [updatingFieldKey, setUpdatingFieldKey] = useState<string | null>(null);

  // Notarieller Status-Override (Pessimistic Confirmation gem. § 17 BeurkG / § 19 BNotO)
  const handleOverrideFieldStatus = async (
    fieldKey: string,
    newStatus: FieldStatus,
    customNote?: string,
    overrideReason?: string
  ) => {
    if (!displayedDossier) return;

    const fieldsRecord = getDossierFieldsRecord(displayedDossier);
    const previousStatus = fieldsRecord[fieldKey]?.status;
    const docId = session.activeDocumentId || vorgangParam;
    const updatedDossier = updateDossierFieldStatus(
      displayedDossier,
      fieldKey,
      newStatus,
      customNote
    );

    setUpdatingFieldKey(fieldKey);
    setErrorMessage(null);

    try {
      if (docId) {
        // Erst nach erfolgreicher Server-Bestätigung (200 OK) im State annehmen
        const auditOverride = overrideReason
          ? {
              fieldKey,
              fieldTitle: fieldKey,
              previousStatus: previousStatus || newStatus,
              newStatus,
              reason: overrideReason,
            }
          : undefined;

        await updateDossier({
          documentId: docId,
          dossier: updatedDossier,
          auditOverride,
        });
      }
      actions.setDossier(updatedDossier);
    } catch (err) {
      console.error('Status-Override fehlgeschlagen:', err);
      setErrorMessage(
        `Die Statusänderung für „${fieldKey}“ konnte nicht in der Kanzleidatenbank gespeichert werden. Bitte wiederholen Sie den Vorgang.`
      );
    } finally {
      setUpdatingFieldKey(null);
    }
  };

  return (
    <div className="bg-background text-foreground selection:bg-notar-300 flex min-h-screen flex-col font-sans antialiased selection:text-slate-900">
      <Header
        caseNumber={session.persistenceInfo?.caseNumber || activeRecord?.title}
        storageType={
          session.persistenceInfo?.storageType ||
          (activeRecord ? STORAGE_TYPES.SUPABASE : undefined)
        }
        overallStatus={displayedDossier?.overallStatus}
        onLogoClick={handleBackToTable}
      />

      {/* Sub-Header Breadcrumb */}
      <div className="mx-auto flex h-9 w-full max-w-7xl items-end px-4 sm:px-6 lg:px-8">
        {effectiveView !== VIEW_MODE.TABLE && (
          <nav className="text-muted-foreground flex items-center gap-2 text-sm sm:text-base">
            <button
              type="button"
              onClick={handleBackToTable}
              className="hover:text-foreground font-medium transition-colors hover:underline"
            >
              Vorgangsübersicht
            </button>
            <ChevronRight className="text-muted-foreground/60 h-4 w-4" />
            <span className="text-foreground font-semibold">
              {effectiveView === VIEW_MODE.UPLOAD
                ? 'Neuer Urkundenvorgang'
                : effectiveView === VIEW_MODE.JOB
                  ? activeJob?.payload.notes?.slice(0, 40) || 'Vorgang in Prüfung'
                  : displayedDossier?.caseTitle || 'Urkunden-Zuarbeit'}
            </span>
          </nav>
        )}
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 pt-3 pb-8 sm:px-6 lg:px-8">
        {/* Ansicht 1: Kanzlei Vorgangsübersicht */}
        {effectiveView === VIEW_MODE.TABLE && (
          <DocumentTable
            documents={documents}
            isLoading={isLoadingDocs}
            onSelectDocument={handleSelectDocument}
            onSelectJob={handleSelectJob}
            onCreateNew={handleCreateNew}
            onDeleteDocument={async (id) => {
              await deleteDocument(id);
            }}
            activeJobs={[...activeJobs, ...failedJobs]}
            onRetryJob={retryJob}
          />
        )}

        {/* Ansicht 2: Upload-Bereich für neue Zuarbeit */}
        {effectiveView === VIEW_MODE.UPLOAD && (
          <NewVorgangUploadView
            files={session.files}
            onFilesChange={actions.setFiles}
            notes={session.notes}
            onNotesChange={actions.setNotes}
            isStarting={isAnalyzing}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            onSubmit={handleStartAnalysis}
          />
        )}

        {/* Ansicht 3: Laufender / fehlgeschlagener Hintergrund-Job (Live-Workflow & Stepper) */}
        {effectiveView === VIEW_MODE.JOB && activeJob && (
          <JobProgressView
            job={activeJob}
            onBackToTable={handleBackToTable}
            onRetryJob={retryJob}
            isRetrying={isRetrying}
          />
        )}

        {/* Ansicht 4: Ergebnis-Ansicht (Dossier Cockpit) */}
        {effectiveView === VIEW_MODE.DETAIL && displayedDossier && (
          <DossierDetailView
            dossier={displayedDossier}
            activeRecord={activeRecord || null}
            onOverrideFieldStatus={handleOverrideFieldStatus}
            updatingFieldKey={updatingFieldKey}
            isAppending={session.isAppending}
            onToggleAppending={() => actions.setIsAppending(!session.isAppending)}
            appendFiles={session.appendFiles}
            onAppendFilesChange={actions.setAppendFiles}
            appendNotes={session.appendNotes}
            onAppendNotesChange={actions.setAppendNotes}
            onCancelAppend={actions.resetAppend}
            onSubmitAppend={handleStartAppendAnalysis}
            isAnalyzing={isAnalyzing}
            activeStep={activeStep}
            stepDetail={stepDetail}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        )}
      </main>

      <footer className="border-border bg-background mt-auto border-t py-4">
        <div className="text-muted-foreground mx-auto flex max-w-7xl items-center justify-between px-4 text-xs sm:px-6 lg:px-8">
          <span>NotarPartner</span>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <Loader2 className="text-notar-900 h-8 w-8 animate-spin" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
