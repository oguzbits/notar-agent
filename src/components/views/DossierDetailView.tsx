'use client';

import { PlusCircle, X, Copy, Check } from 'lucide-react';
import React, { useState } from 'react';
import { AgenticWorkflowStepper } from '@/components/AgenticWorkflowStepper';
import { DocumentDetectionList } from '@/components/DocumentDetectionList';
import { getStatusBadge } from '@/components/DocumentTable';
import { ExportActions } from '@/components/ExportActions';
import { UnifiedFieldCockpitTable } from '@/components/FieldCockpit/UnifiedFieldCockpitTable';
import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { UploadZone } from '@/components/UploadZone';
import { generatePruefberichtText } from '@/lib/dossier';
import { formatDateTimeGerman } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DocumentRecord, CASE_STATUS } from '@/types/document';
import { Dossier, FieldStatus, UploadedFilePayload } from '@/types/dossier';

interface DossierDetailViewProps {
  dossier: Dossier;
  activeRecord: DocumentRecord | null;
  onOverrideFieldStatus: (
    fieldKey: string,
    newStatus: FieldStatus,
    customNote?: string,
    overrideReason?: string
  ) => void;
  updatingFieldKey?: string | null;
  // Nachreichen
  isAppending: boolean;
  onToggleAppending: () => void;
  appendFiles: UploadedFilePayload[];
  onAppendFilesChange: (files: UploadedFilePayload[]) => void;
  appendNotes: string;
  onAppendNotesChange: (notes: string) => void;
  onCancelAppend: () => void;
  onSubmitAppend: () => void;
  // Workflow / Loader
  isAnalyzing: boolean;
  activeStep: 1 | 2 | 3;
  stepDetail: string;
  errorMessage: string | null;
  onClearError: () => void;
}

export const DossierDetailView: React.FC<DossierDetailViewProps> = ({
  dossier,
  activeRecord,
  onOverrideFieldStatus,
  updatingFieldKey,
  isAppending,
  onToggleAppending,
  appendFiles,
  onAppendFilesChange,
  appendNotes,
  onAppendNotesChange,
  onCancelAppend,
  onSubmitAppend,
  isAnalyzing,
  activeStep,
  stepDetail,
  errorMessage,
  onClearError,
}) => {
  const [hasCopiedPruefbericht, setHasCopiedPruefbericht] = useState(false);

  const handleCopyPruefbericht = () => {
    const text = generatePruefberichtText(dossier);
    navigator.clipboard.writeText(text);
    setHasCopiedPruefbericht(true);
    setTimeout(() => setHasCopiedPruefbericht(false), 2000);
  };

  return (
    <section className="animate-in fade-in space-y-3 duration-300">
      {/* Action Bar oben mit Vorgangsname, Status/Stand und Aktionen */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2.5 border-b pb-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
            {dossier.caseTitle}
          </h2>
          <div className="flex items-center gap-2">
            {getStatusBadge(activeRecord?.status || CASE_STATUS.IN_PROGRESS)}
            <span className="text-muted-foreground text-sm">
              Stand: {formatDateTimeGerman(activeRecord?.created_at || dossier.analysisTimestamp)}
              {' Uhr'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAppending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-base font-semibold shadow-xs transition-colors',
              isAppending
                ? 'border-notar-900 bg-notar-500 text-notar-950'
                : 'border-border bg-background hover:bg-muted text-foreground'
            )}
          >
            {isAppending ? (
              <>
                <X className="h-4 w-4" />
                <span>Schließen</span>
              </>
            ) : (
              <>
                <PlusCircle className="text-notar-900 h-4 w-4" />
                <span>Unterlagen nachreichen</span>
              </>
            )}
          </button>
          <ExportActions dossier={dossier} documentId={activeRecord?.id} />
        </div>
      </div>

      {/* Aufklappbarer Bereich: Unterlagen nachreichen */}
      {isAppending && (
        <div className="bg-card border-border rounded-xl border p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-foreground text-base font-semibold">
              Weitere Unterlagen zu diesem Vorgang nachreichen
            </h3>
            <p className="text-muted-foreground text-base">
              Laden Sie z. B. nachgeforderte Grundbuchauszüge, Vollmachten oder Energieausweise
              hoch. Die KI aktualisiert das bestehende Dossier und schließt offene Prüfpunkte.
            </p>
          </div>

          {/* Fehlermeldung beim Nachreichen */}
          {errorMessage && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive mb-4 flex items-start justify-between gap-3 rounded-xl border p-4 text-base">
              <div>
                <strong>Aktualisierung fehlgeschlagen:</strong> {errorMessage}
              </div>
              <button
                type="button"
                onClick={onClearError}
                className="text-destructive/80 hover:text-destructive cursor-pointer"
                aria-label="Fehlermeldung schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <UploadZone
            onFilesReady={onAppendFilesChange}
            notes={appendNotes}
            onNotesChange={onAppendNotesChange}
            isAnalyzing={isAnalyzing}
          />

          {/* Live-Workflow-Anzeige beim Nachreichen (Echtzeit-SSE-gesteuert) */}
          <div className="pt-3">
            <AgenticWorkflowStepper
              isAnalyzing={isAnalyzing}
              activeStep={activeStep}
              stepDetail={stepDetail}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isAnalyzing}
              onClick={onCancelAppend}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={appendFiles.length === 0 && !appendNotes.trim()}
              isLoading={isAnalyzing}
              onClick={onSubmitAppend}
            >
              {isAnalyzing
                ? 'Dossier wird aktualisiert...'
                : `Dossier aktualisieren${
                    appendFiles.length > 0
                      ? ` (${appendFiles.length} ${appendFiles.length === 1 ? 'Datei' : 'Dateien'})`
                      : ''
                  }`}
            </Button>
          </div>
        </div>
      )}

      {/* Die zwei klar getrennten Hauptbereiche des Vorgangs (Master-Cockpit + Aktenbestand) */}
      <div className="space-y-4 pt-0.5">
        {/* BEREICH 1: Notarielles Prüf-Cockpit & Pflichtangaben */}
        <section className="bg-card border-border overflow-hidden rounded-xl border shadow-xs transition-all">
          <div className="border-border/80 bg-muted/40 border-b px-3.5 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="bg-notar-900 text-2xs flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold text-white shadow-xs">
                  1
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground text-base font-bold tracking-tight sm:text-base">
                      Prüfbericht &amp; Notarielle Pflichtangaben
                    </h2>
                  </div>
                  <p className="text-muted-foreground text-base">
                    Verbindlicher Stand der 10 Pflichtfelder mit Belegnachweisen und
                    Reifegrad-Bewertung.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPruefbericht}
                  title="Vollständigen Prüfbericht mit allen Quellen für Zwischenablage kopieren"
                  className="border-border bg-card text-foreground hover:bg-muted/60 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-base font-medium shadow-xs transition-colors"
                >
                  {hasCopiedPruefbericht ? (
                    <>
                      <Check className="text-notar-700 dark:text-notar-400 h-4 w-4" />
                      <span className="text-notar-900 dark:text-notar-300 font-semibold">
                        Kopiert!
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="text-muted-foreground h-4 w-4" />
                      <span>Prüfbericht kopieren</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-2.5 sm:p-3">
            <ErrorBoundary
              fallbackTitle="Cockpit-Tabelle konnte nicht geladen werden"
              fallbackDescription="Die notariellen Pflichtangaben konnten aufgrund eines Darstellungsfehlers nicht gerendert werden."
            >
              <UnifiedFieldCockpitTable
                dossier={dossier}
                onOverrideFieldStatus={onOverrideFieldStatus}
                updatingFieldKey={updatingFieldKey}
              />
            </ErrorBoundary>
          </div>
        </section>

        {/* BEREICH 2: Vorgelegte Unterlagen & Aktenbestand */}
        <section className="bg-card border-border overflow-hidden rounded-xl border shadow-xs transition-all">
          <div className="border-border/80 bg-muted/40 border-b px-3.5 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="bg-foreground text-background text-2xs flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold shadow-xs">
                  2
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground text-base font-bold tracking-tight sm:text-base">
                      Vorgelegte Unterlagen &amp; Aktenbestand
                    </h2>
                    <span className="border-border bg-muted/60 text-muted-foreground rounded-full border px-2.5 py-0.5 text-sm font-semibold">
                      {dossier.detectedDocuments?.length || 0} Dokument(e) &amp; Notiz(en)
                    </span>
                  </div>
                  <p className="text-muted-foreground text-base">
                    Vollständiges Aktenverzeichnis inklusive Urkunden, Gutachten und ungekürzter
                    Sachbearbeitungs-Notizen
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 sm:p-3">
            <ErrorBoundary
              fallbackTitle="Aktenbestand konnte nicht visualisiert werden"
              fallbackDescription="Die Dokumentenliste konnte aufgrund eines Fehlers nicht gerendert werden."
            >
              <DocumentDetectionList documents={dossier.detectedDocuments} />
            </ErrorBoundary>
          </div>
        </section>
      </div>
    </section>
  );
};
