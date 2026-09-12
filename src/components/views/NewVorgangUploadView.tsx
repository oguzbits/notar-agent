'use client';

import { X } from 'lucide-react';
import React from 'react';
import { AgenticWorkflowStepper } from '@/components/AgenticWorkflowStepper';
import { Button } from '@/components/ui/Button';
import { UploadZone, PreparedFile } from '@/components/UploadZone';
import { CaseType } from '@/types/dossier';

interface NewVorgangUploadViewProps {
  files: PreparedFile[];
  onFilesChange: (files: PreparedFile[]) => void;
  caseType: CaseType;
  onCaseTypeChange: (type: CaseType) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  isAnalyzing: boolean;
  activeStep: 1 | 2 | 3;
  stepDetail: string;
  errorMessage: string | null;
  onClearError: () => void;
  onSubmit: () => void;
}

export const NewVorgangUploadView: React.FC<NewVorgangUploadViewProps> = ({
  files,
  onFilesChange,
  caseType,
  onCaseTypeChange,
  notes,
  onNotesChange,
  isAnalyzing,
  activeStep,
  stepDetail,
  errorMessage,
  onClearError,
  onSubmit,
}) => {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          Neuer Urkundenvorgang
        </h1>
        <p className="text-muted-foreground mt-0.5 text-base">
          Automatische Dokumentenprüfung und Datenextraktion: Laden Sie Aktenunterlagen hoch, um
          alle beurkundungsrelevanten Angaben samt Quellenbelegen und Reifegrad zu ermitteln.
        </p>
      </div>

      {/* Fehlermeldung nur im Upload-Kontext anzeigen */}
      {errorMessage && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-800">
          <div>
            <strong>Prüfung fehlgeschlagen:</strong> {errorMessage}
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="text-red-600 hover:text-red-800"
            aria-label="Fehlermeldung schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <UploadZone
        onFilesReady={onFilesChange}
        notes={notes}
        onNotesChange={onNotesChange}
        isAnalyzing={isAnalyzing}
      />

      {/* Live-Workflow-Anzeige während der KI-Verarbeitung (Echtzeit-SSE-gesteuert) */}
      <AgenticWorkflowStepper
        isAnalyzing={isAnalyzing}
        activeStep={activeStep}
        stepDetail={stepDetail}
      />

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          disabled={files.length === 0}
          isLoading={isAnalyzing}
          onClick={onSubmit}
          size="md"
          className="px-5 py-2.5 text-base"
        >
          {isAnalyzing ? 'Unterlagen werden geprüft...' : 'Unterlagen prüfen'}
        </Button>
      </div>
    </section>
  );
};
