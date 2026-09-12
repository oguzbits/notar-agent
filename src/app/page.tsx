'use client';

import { Loader2, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { DossierDetailView } from '@/components/views/DossierDetailView';
import { NewVorgangUploadView } from '@/components/views/NewVorgangUploadView';
import { VorgangTableView } from '@/components/views/VorgangTableView';
import { useAnalysisWorkflow } from '@/hooks/useAnalysisWorkflow';
import { useDocuments } from '@/hooks/useDocuments';
import { useVorgangSession } from '@/hooks/useVorgangSession';
import { normalizeDossier } from '@/lib/dossier-helpers';
import { DocumentRecord, computeDocumentStatus } from '@/lib/supabase/server';
import { FieldStatus, updateDossierFieldStatus } from '@/types/dossier';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vorgangParam = searchParams.get('vorgang');
  const viewParam = searchParams.get('view');

  // Custom Hooks für isolierte Zustände
  const { documents, setDocuments, isLoadingDocs, loadDocuments, deleteDocument, updateDossier } =
    useDocuments();
  const {
    isAnalyzing,
    activeStep,
    stepDetail,
    errorMessage,
    setErrorMessage,
    startAnalysis,
    startAppendAnalysis,
  } = useAnalysisWorkflow();
  const { state: session, actions } = useVorgangSession();

  // Selektierten Datensatz auflösen
  const activeRecord = vorgangParam ? documents.find((d) => d.id === vorgangParam) : null;
  const rawDisplayedDossier = activeRecord?.content || session.dossier;
  const displayedDossier = rawDisplayedDossier ? normalizeDossier(rawDisplayedDossier) : null;

  const effectiveView: 'table' | 'upload' | 'detail' =
    vorgangParam && displayedDossier ? 'detail' : viewParam === 'upload' ? 'upload' : 'table';

  // Navigation Aktionen
  const handleSelectDocument = (doc: DocumentRecord) => {
    if (doc.content) {
      setErrorMessage(null);
      actions.selectDocument(doc.id, doc.content, doc.title);
      router.push(`/?vorgang=${encodeURIComponent(doc.id)}`);
    }
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

  // Analyse-Trigger
  const handleStartAnalysis = async () => {
    try {
      await startAnalysis(session.files, session.caseType, session.notes, (result) => {
        actions.setDossier(result.dossier);
        if (result.persistence) {
          const newId = result.persistence.id || null;
          actions.setActiveDocumentId(newId);
          actions.setPersistenceInfo({
            storageType: result.persistence.storageType,
            caseNumber: result.persistence.caseNumber,
          });
          if (newId) {
            router.push(`/?vorgang=${encodeURIComponent(newId)}`);
          }
        }
      });
      loadDocuments();
    } catch (err) {
      console.error('Analyse-Start fehlgeschlagen:', err);
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
          const docId = session.activeDocumentId || vorgangParam;
          if (docId) {
            const computedStatus = computeDocumentStatus(result.dossier);
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === docId ? { ...d, status: computedStatus, content: result.dossier } : d
              )
            );
          }
        }
      );
      loadDocuments();
    } catch (err) {
      console.error('Nachreich-Analyse fehlgeschlagen:', err);
    }
  };

  // Notarieller Status-Override
  const handleOverrideFieldStatus = (
    fieldKey: string,
    newStatus: FieldStatus,
    customNote?: string
  ) => {
    if (!displayedDossier) return;

    const updatedDossier = updateDossierFieldStatus(
      displayedDossier,
      fieldKey,
      newStatus,
      customNote
    );

    actions.setDossier(updatedDossier);

    const docId = session.activeDocumentId || vorgangParam;
    if (docId) {
      const computedStatus = computeDocumentStatus(updatedDossier);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, status: computedStatus, content: updatedDossier } : d
        )
      );

      updateDossier({ documentId: docId, dossier: updatedDossier }).catch((err) => {
        console.warn('Hintergrund-Update fehlgeschlagen:', err);
      });
    }
  };

  return (
    <div className="bg-background text-foreground selection:bg-notar-300 flex min-h-screen flex-col font-sans antialiased selection:text-slate-900">
      <Header
        caseNumber={session.persistenceInfo?.caseNumber || activeRecord?.title}
        storageType={
          session.persistenceInfo?.storageType || (activeRecord ? 'supabase' : undefined)
        }
        overallStatus={displayedDossier?.overallStatus}
        onLogoClick={handleBackToTable}
      />

      {/* Sub-Header Breadcrumb */}
      <div className="mx-auto flex h-9 w-full max-w-7xl items-end px-4 sm:px-6 lg:px-8">
        {effectiveView !== 'table' && (
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
              {effectiveView === 'upload'
                ? 'Neuer Urkundenvorgang'
                : displayedDossier?.caseTitle || 'Urkunden-Zuarbeit'}
            </span>
          </nav>
        )}
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 pt-3 pb-8 sm:px-6 lg:px-8">
        {/* Ansicht 1: Kanzlei Vorgangsübersicht */}
        {effectiveView === 'table' && (
          <VorgangTableView
            documents={documents}
            isLoading={isLoadingDocs}
            onSelectDocument={handleSelectDocument}
            onCreateNew={handleCreateNew}
            onDeleteDocument={async (id) => {
              await deleteDocument(id);
            }}
          />
        )}

        {/* Ansicht 2: Upload-Bereich für neue Zuarbeit */}
        {effectiveView === 'upload' && (
          <NewVorgangUploadView
            files={session.files}
            onFilesChange={actions.setFiles}
            caseType={session.caseType}
            onCaseTypeChange={actions.setCaseType}
            notes={session.notes}
            onNotesChange={actions.setNotes}
            isAnalyzing={isAnalyzing}
            activeStep={activeStep}
            stepDetail={stepDetail}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            onSubmit={handleStartAnalysis}
          />
        )}

        {/* Ansicht 3: Ergebnis-Ansicht (Dossier Cockpit) */}
        {effectiveView === 'detail' && displayedDossier && (
          <DossierDetailView
            dossier={displayedDossier}
            activeRecord={activeRecord || null}
            onOverrideFieldStatus={handleOverrideFieldStatus}
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
