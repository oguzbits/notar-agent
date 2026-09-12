'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { PreparedFile } from '@/components/UploadZone';
import { Dossier, CaseType, FieldStatus, GenericFieldDossier } from '@/types/dossier';
import { DocumentRecord, computeDocumentStatus } from '@/lib/supabase/server';
import { normalizeDossier } from '@/lib/dossier-helpers';
import { useDocuments } from '@/hooks/useDocuments';
import { useAnalysisWorkflow } from '@/hooks/useAnalysisWorkflow';
import { VorgangTableView } from '@/components/views/VorgangTableView';
import { NewVorgangUploadView } from '@/components/views/NewVorgangUploadView';
import { DossierDetailView } from '@/components/views/DossierDetailView';
import { Loader2, ChevronRight } from 'lucide-react';

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

  // Lokale UI-Zustände
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [caseType, setCaseType] = useState<CaseType>('IMMOBILIENKAUF');
  const [notes, setNotes] = useState('');
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [isAppending, setIsAppending] = useState(false);
  const [appendFiles, setAppendFiles] = useState<PreparedFile[]>([]);
  const [appendNotes, setAppendNotes] = useState('');
  const [persistenceInfo, setPersistenceInfo] = useState<{
    storageType: 'supabase' | 'in-memory' | 'none' | 'local-only';
    caseNumber: string;
  } | null>(null);

  // Selektierten Datensatz auflösen
  const activeRecord = vorgangParam ? documents.find((d) => d.id === vorgangParam) : null;
  const rawDisplayedDossier = activeRecord?.content || dossier;
  const displayedDossier = rawDisplayedDossier ? normalizeDossier(rawDisplayedDossier) : null;

  const effectiveView: 'table' | 'upload' | 'detail' =
    vorgangParam && displayedDossier ? 'detail' : viewParam === 'upload' ? 'upload' : 'table';

  // Navigation Aktionen
  const handleSelectDocument = (doc: DocumentRecord) => {
    if (doc.content) {
      setErrorMessage(null);
      setDossier(doc.content);
      setActiveDocumentId(doc.id);
      setIsAppending(false);
      setAppendFiles([]);
      setAppendNotes('');
      setFiles([]);
      setNotes('');
      setPersistenceInfo({
        storageType: 'supabase',
        caseNumber: doc.title,
      });
      router.push(`/?vorgang=${encodeURIComponent(doc.id)}`);
    }
  };

  const handleCreateNew = () => {
    setDossier(null);
    setActiveDocumentId(null);
    setFiles([]);
    setNotes('');
    setIsAppending(false);
    setErrorMessage(null);
    router.push('/?view=upload');
  };

  const handleBackToTable = () => {
    setDossier(null);
    setActiveDocumentId(null);
    setIsAppending(false);
    setErrorMessage(null);
    router.push('/');
  };

  // Analyse-Trigger
  const handleStartAnalysis = async () => {
    try {
      await startAnalysis(files, caseType, notes, (result) => {
        setDossier(result.dossier);
        if (result.persistence) {
          const newId = result.persistence.id || null;
          setActiveDocumentId(newId);
          setPersistenceInfo({
            storageType: result.persistence.storageType,
            caseNumber: result.persistence.caseNumber,
          });
          if (newId) {
            router.push(`/?vorgang=${encodeURIComponent(newId)}`);
          }
        }
      });
      loadDocuments();
    } catch {
      // Fehler bereits im Hook verarbeitet
    }
  };

  const handleStartAppendAnalysis = async () => {
    if (!displayedDossier) return;
    try {
      await startAppendAnalysis(
        activeDocumentId || vorgangParam,
        displayedDossier,
        appendFiles,
        appendNotes,
        (result) => {
          setDossier(result.dossier);
          setIsAppending(false);
          setAppendFiles([]);
          setAppendNotes('');
          const docId = activeDocumentId || vorgangParam;
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
    } catch {
      // Fehler bereits im Hook verarbeitet
    }
  };

  // Notarieller Status-Override
  const handleOverrideFieldStatus = (
    fieldKey: string,
    newStatus: FieldStatus,
    customNote?: string
  ) => {
    if (!displayedDossier) return;

    const currentFields = { ...displayedDossier.fields } as Record<
      string,
      GenericFieldDossier<unknown>
    >;
    if (currentFields[fieldKey]) {
      currentFields[fieldKey] = {
        ...currentFields[fieldKey],
        status: newStatus,
        note: customNote ? customNote : currentFields[fieldKey].note,
      };
    }

    const allVerified = Object.values(currentFields).every((f) => f.status === 'VERIFIED');
    const newOverall = allVerified ? 'READY' : displayedDossier.overallStatus;

    const updatedDossier: Dossier = {
      ...displayedDossier,
      fields: currentFields as Dossier['fields'],
      overallStatus: newOverall,
    };

    setDossier(updatedDossier);

    const docId = activeDocumentId || vorgangParam;
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
    <div className="bg-background text-foreground selection:bg-documenso-300 flex min-h-screen flex-col font-sans antialiased selection:text-slate-900">
      <Header
        caseNumber={persistenceInfo?.caseNumber || activeRecord?.title}
        storageType={persistenceInfo?.storageType || (activeRecord ? 'supabase' : undefined)}
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
            files={files}
            onFilesChange={setFiles}
            caseType={caseType}
            onCaseTypeChange={setCaseType}
            notes={notes}
            onNotesChange={setNotes}
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
            isAppending={isAppending}
            onToggleAppending={() => setIsAppending(!isAppending)}
            appendFiles={appendFiles}
            onAppendFilesChange={setAppendFiles}
            appendNotes={appendNotes}
            onAppendNotesChange={setAppendNotes}
            onCancelAppend={() => {
              setIsAppending(false);
              setAppendFiles([]);
              setAppendNotes('');
            }}
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
          <Loader2 className="h-8 w-8 animate-spin text-[#356611]" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
