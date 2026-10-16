'use client';

import { UploadCloud, Trash2, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { UploadNotes } from '@/components/UploadNotes';
import { validateFiles } from '@/lib/files/file-preparer';
import { getSupportedUploadAcceptString } from '@/lib/files/file-types';
import { uploadFilesDirectly } from '@/lib/files/storage-uploader';
import { cn } from '@/lib/utils';
import { useOptionalAuth } from '@/providers/AuthProvider';
import { UploadedFilePayload } from '@/types/dossier';

interface UploadZoneProps {
  files?: UploadedFilePayload[];
  onFilesReady: (files: UploadedFilePayload[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  isAnalyzing: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  files,
  onFilesReady,
  notes,
  onNotesChange,
  isAnalyzing,
}) => {
  const auth = useOptionalAuth();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedItems = files !== undefined ? files : selectedFiles;

  const handleFilesAdded = async (filesToAdd: FileList | File[]) => {
    setParseError(null);
    const incomingFiles = Array.from(filesToAdd);

    const validation = validateFiles(incomingFiles);
    if (!validation.valid && validation.error) {
      setParseError(validation.error);
      return;
    }

    const combined = [...selectedFiles, ...incomingFiles];
    setSelectedFiles(combined);
    await processAndDispatchFiles(combined);
  };

  const removeFile = async (index: number) => {
    if (files !== undefined) {
      const updated = files.filter((_, i) => i !== index);
      onFilesReady(updated);
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    await processAndDispatchFiles(updated);
  };

  const processAndDispatchFiles = async (files: File[]) => {
    if (files.length === 0) {
      onFilesReady([]);
      return;
    }

    setIsPreparing(true);
    try {
      const prepared = await uploadFilesDirectly(files, {
        organizationId: auth?.organization?.id,
      });
      onFilesReady(prepared);
    } catch (err) {
      console.warn('Fehler beim Einlesen einzelner Dateien:', err);
      setParseError('Fehler beim Einlesen einzelner Dateien.');
    } finally {
      setIsPreparing(false);
    }
  };

  const isBusy = isAnalyzing || isPreparing;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h2 className="text-foreground text-base font-semibold">Dokumente &amp; Unterlagen</h2>
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        role="button"
        tabIndex={isBusy ? -1 : 0}
        aria-disabled={isBusy}
        aria-label="Dokumente auswählen oder hierher ziehen"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!isBusy && e.dataTransfer.files) {
            handleFilesAdded(e.dataTransfer.files);
          }
        }}
        onClick={(e) => {
          // Das vom Eingabefeld selbst aufsteigende Klick-Ereignis nicht erneut verarbeiten
          if (!isBusy && e.target !== fileInputRef.current) {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          'focus-visible:ring-ring rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
          isBusy
            ? 'border-border/60 bg-muted/10 cursor-not-allowed opacity-60'
            : dragOver
              ? 'border-notar-700 bg-notar-200/20 cursor-pointer'
              : 'border-border bg-muted/20 hover:border-notar-600 cursor-pointer'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getSupportedUploadAcceptString()}
          disabled={isBusy}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesAdded(e.target.files);
            }
          }}
        />
        <div className="flex flex-col items-center justify-center gap-2.5">
          <div
            className={cn(
              'rounded-xl p-3 shadow-xs',
              isAnalyzing ? 'bg-muted text-muted-foreground' : 'bg-notar-500 text-notar-950'
            )}
          >
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <p className="text-foreground text-base font-semibold">
              Dateien per Drag &amp; Drop hier ablegen oder{' '}
              <span
                className={cn(
                  'font-semibold underline decoration-2 underline-offset-2',
                  isAnalyzing
                    ? 'text-muted-foreground no-underline'
                    : 'text-foreground hover:text-notar-950'
                )}
              >
                durchsuchen
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Alle gängigen Dokumenten- und Bildformate werden unterstützt
            </p>
          </div>
        </div>
      </div>

      {parseError && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3.5 text-base">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Dateiliste */}
      {displayedItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-foreground flex items-center justify-between text-sm font-semibold">
            <span>Ausgewählte Dokumente ({displayedItems.length}):</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {displayedItems.map((file, idx) => {
              const isImg = file.type.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="border-border bg-card flex items-center justify-between rounded-lg border p-3 shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {isImg ? (
                      <ImageIcon className="text-google-blue h-4.5 w-4.5 shrink-0" />
                    ) : (
                      <FileText className="text-notar-900 h-4.5 w-4.5 shrink-0" />
                    )}
                    <div className="truncate">
                      <p
                        className="text-foreground truncate text-base font-medium"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {Math.round(file.size / 1024)} KB
                      </p>
                    </div>
                  </div>
                  {!isAnalyzing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-muted-foreground hover:text-destructive focus-visible:ring-destructive cursor-pointer rounded-md p-1.5 transition-colors focus-visible:ring-2"
                      title="Datei entfernen"
                      aria-label={`Datei ${file.name} entfernen`}
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <UploadNotes notes={notes} onNotesChange={onNotesChange} disabled={isAnalyzing} />
    </div>
  );
};
