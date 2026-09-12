'use client';

import {
  UploadCloud,
  Trash2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  MessageSquareText,
  Plus,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { type PreparedFile, validateFiles, prepareFiles } from '@/lib/files/file-preparer';
import { CaseType } from '@/types/dossier';

export type { PreparedFile };

interface UploadZoneProps {
  onFilesReady: (files: PreparedFile[]) => void;
  caseType?: CaseType;
  onCaseTypeChange?: (type: CaseType) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  isAnalyzing: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesReady,
  notes,
  onNotesChange,
  isAnalyzing,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [, setIsPreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const prepared = await prepareFiles(files);
      onFilesReady(prepared);
    } catch (err) {
      console.warn('Fehler beim Einlesen einzelner Dateien:', err);
      setParseError('Fehler beim Einlesen einzelner Dateien.');
    } finally {
      setIsPreparing(false);
    }
  };

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
        onDragOver={(e) => {
          e.preventDefault();
          if (!isAnalyzing) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!isAnalyzing && e.dataTransfer.files) {
            handleFilesAdded(e.dataTransfer.files);
          }
        }}
        onClick={() => {
          if (!isAnalyzing) {
            fileInputRef.current?.click();
          }
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isAnalyzing
            ? 'border-border/60 bg-muted/10 cursor-not-allowed opacity-60'
            : dragOver
              ? 'border-notar-700 bg-notar-200/20 cursor-pointer'
              : 'border-border bg-muted/20 hover:border-notar-600 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={isAnalyzing}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesAdded(e.target.files);
            }
          }}
        />
        <div className="flex flex-col items-center justify-center gap-2.5">
          <div
            className={`rounded-xl p-3 shadow-xs ${
              isAnalyzing ? 'bg-muted text-muted-foreground' : 'bg-notar-500 text-notar-950'
            }`}
          >
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <p className="text-foreground text-base font-semibold">
              Dateien per Drag &amp; Drop hier ablegen oder{' '}
              <span
                className={`font-semibold underline decoration-2 underline-offset-2 ${
                  isAnalyzing
                    ? 'text-muted-foreground no-underline'
                    : 'text-foreground hover:text-notar-950'
                }`}
              >
                durchsuchen
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Alle gängigen Dokumenten- und Bildformate werden unterstützt
            </p>
          </div>
        </div>
      </div>

      {parseError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Dateiliste */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-foreground flex items-center justify-between text-xs font-semibold">
            <span>Ausgewählte Dokumente ({selectedFiles.length}):</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {selectedFiles.map((file, idx) => {
              const isImg = file.type.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="border-border bg-card flex items-center justify-between rounded-lg border p-2.5 text-xs shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isImg ? (
                      <ImageIcon className="h-4 w-4 shrink-0 text-sky-500" />
                    ) : (
                      <FileText className="text-notar-900 h-4 w-4 shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="text-foreground truncate font-medium" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-muted-foreground text-3xs">
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
                      className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                      title="Datei entfernen"
                      aria-label={`Datei ${file.name} entfernen`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feste Notiz-Sektion für Sachverhalt & Telefonate (nicht einklappbar) */}
      <div className="border-border space-y-3 border-t pt-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="text-notar-900 h-4 w-4" />
          <h2 className="text-foreground text-base font-semibold">
            Ergänzende Hinweise &amp; interne Notizen zur Akte (optional)
          </h2>
          {notes.trim().length > 0 && <span className="bg-notar-500 h-2 w-2 rounded-full" />}
        </div>

        <div className="space-y-3">
          {(() => {
            const noteList = notes ? notes.split('\n\n') : [''];
            const updateNoteAt = (idx: number, val: string) => {
              const updated = [...noteList];
              updated[idx] = val;
              onNotesChange(updated.join('\n\n'));
            };
            const addNoteField = () => {
              const updated = [...noteList, ''];
              onNotesChange(updated.join('\n\n'));
            };
            const removeNoteAt = (idx: number) => {
              if (noteList.length <= 1) {
                onNotesChange('');
                return;
              }
              const updated = noteList.filter((_, i) => i !== idx);
              onNotesChange(updated.join('\n\n'));
            };

            return (
              <div className="space-y-2.5">
                {noteList.map((noteText, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground text-2xs font-medium">
                        {`Notiz #${idx + 1}`}
                      </label>
                      {noteList.length > 1 && !isAnalyzing && (
                        <button
                          type="button"
                          onClick={() => removeNoteAt(idx)}
                          className="text-muted-foreground hover:text-destructive text-2xs cursor-pointer transition-colors"
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                    <textarea
                      value={noteText}
                      disabled={isAnalyzing}
                      onChange={(e) => updateNoteAt(idx, e.target.value)}
                      placeholder="Ergänzende Sachverhaltsangaben, aktuelle Absprachen oder interne Bearbeitungshinweise für die Zuarbeit..."
                      rows={3}
                      className={`border-border bg-muted/30 focus:bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full resize-y rounded-lg border p-3 text-base focus:ring-1 focus:outline-none ${
                        isAnalyzing ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    />
                  </div>
                ))}

                {!isAnalyzing && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={addNoteField}
                      className="border-border hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      <Plus className="text-notar-900 h-3.5 w-3.5" />
                      <span>Weiteres Notizfeld hinzufügen</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-muted-foreground text-base leading-relaxed">
            Diese Notizen fließen direkt in die Prüfung ein und ergänzen bzw. aktualisieren die
            Angaben aus den hochgeladenen Dokumenten.
          </p>
        </div>
      </div>
    </div>
  );
};
