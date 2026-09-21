'use client';

import { X } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/Button';
import { UploadZone } from '@/components/UploadZone';
import { UploadedFilePayload } from '@/types/dossier';

interface NewVorgangUploadViewProps {
  files: UploadedFilePayload[];
  onFilesChange: (files: UploadedFilePayload[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  isStarting?: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  onSubmit: () => void;
}

export const NewVorgangUploadView: React.FC<NewVorgangUploadViewProps> = ({
  files,
  onFilesChange,
  notes,
  onNotesChange,
  isStarting = false,
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
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start justify-between gap-3 rounded-xl border p-4 text-base">
          <div>
            <strong>Prüfung fehlgeschlagen:</strong> {errorMessage}
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
        onFilesReady={onFilesChange}
        notes={notes}
        onNotesChange={onNotesChange}
        isAnalyzing={isStarting}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={isStarting}
          onClick={() => {
            onFilesChange([
              {
                name: 'Kaufvertragsentwurf_Friedrichshain_Muster.txt',
                type: 'text/plain',
                size: 4096,
                content:
                  'Kaufvertragsentwurf: Verkäufer: Thomas Weber, Käufer: Sabine Klein. Kaufpreis: 485.000 EUR. Grundbuch von Friedrichshain Blatt 4512.',
                isBase64: false,
              },
            ]);
            onNotesChange(
              'Kaufvertrag Eigentumswohnung Friedrichshain mit Stellplatz. Erwerb zur Eigennutzung.'
            );
          }}
        >
          Muster-Kaufvertrag laden
        </Button>

        <Button
          type="button"
          disabled={files.length === 0}
          isLoading={isStarting}
          onClick={onSubmit}
          size="md"
        >
          {isStarting ? 'Vorgang wird gestartet...' : 'Unterlagen prüfen'}
        </Button>
      </div>
    </section>
  );
};
