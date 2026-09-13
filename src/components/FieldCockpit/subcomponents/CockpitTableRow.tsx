import { FileText, ChevronDown, ChevronUp, Pencil, Quote } from 'lucide-react';
import React, { useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FieldObservation } from '@/lib/dossier/types';
import { cn } from '@/lib/utils';
import { Dossier, FieldStatus } from '@/types/dossier';
import { FieldDetailContent } from '../FieldDetailContent';
import { InlineNoteEditor } from './InlineNoteEditor';
import { StatusOverrideDropdown } from './StatusOverrideDropdown';

interface CockpitTableRowProps {
  row: FieldObservation;
  dossier: Dossier;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOverrideFieldStatus?: (fieldKey: string, newStatus: FieldStatus, note?: string) => void;
  updatingFieldKey?: string | null;
}

export const CockpitTableRow: React.FC<CockpitTableRowProps> = ({
  row,
  dossier,
  isExpanded,
  onToggleExpand,
  onOverrideFieldStatus,
  updatingFieldKey,
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);

  const hasSources = row.sources && row.sources.length > 0;

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('a')
    ) {
      return;
    }

    onToggleExpand();
  };

  const handleSaveNote = (newNote: string) => {
    if (onOverrideFieldStatus) {
      onOverrideFieldStatus(row.fieldKey, row.status, newNote);
    }
    setIsEditingNote(false);
  };

  return (
    <React.Fragment>
      <tr
        onClick={handleRowClick}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={`field-detail-${row.fieldKey}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className={cn(
          'focus-visible:ring-notar-900 cursor-pointer align-top transition-colors select-text focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset',
          isExpanded ? 'bg-muted/20' : 'hover:bg-muted/30'
        )}
      >
        {/* Index */}
        <td className="w-10 min-w-10 px-2 py-2.5 text-center">
          <span className="bg-muted text-muted-foreground inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold">
            {row.fieldIndex}
          </span>
        </td>

        {/* Pflichtfeld Name */}
        <td className="w-36 min-w-36 px-2 py-2.5 leading-snug break-words">
          <span className="text-foreground block font-semibold">{row.fieldTitle}</span>
        </td>

        {/* Status mit direkt anklickbarem Dropdown */}
        <td className="w-40 min-w-40 px-4 py-2.5 whitespace-nowrap">
          {onOverrideFieldStatus ? (
            <StatusOverrideDropdown
              status={row.status}
              isUpdating={updatingFieldKey === row.fieldKey}
              onChange={(newStatus) => onOverrideFieldStatus(row.fieldKey, newStatus, row.note)}
            />
          ) : (
            <StatusBadge status={row.status} size="sm" />
          )}
        </td>

        {/* Befund & Prüfungshinweis */}
        <td
          className="space-y-1.5 px-4 py-2.5"
          onClick={(e) => {
            if (!isEditingNote && onOverrideFieldStatus) {
              e.stopPropagation();
              setIsEditingNote(true);
            }
          }}
        >
          {isEditingNote ? (
            <InlineNoteEditor
              fieldKey={row.fieldKey}
              initialNote={row.note}
              onSave={handleSaveNote}
              onCancel={() => setIsEditingNote(false)}
            />
          ) : (
            <div className="group relative flex items-start justify-between gap-2">
              <p className="leading-relaxed text-slate-800 dark:text-slate-200">{row.note}</p>
              {onOverrideFieldStatus && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingNote(true);
                  }}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  title="Befund/Hinweis bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-500" />
                </button>
              )}
            </div>
          )}
          {row.actionRequired && (
            <div className="inline-flex items-start gap-1.5 rounded border border-emerald-200/60 bg-emerald-50/70 px-2.5 py-1 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <strong className="shrink-0 font-semibold">Empfehlung:</strong>
              <span className="leading-snug">{row.actionRequired}</span>
            </div>
          )}
        </td>

        {/* Quellen / Nachweise */}
        <td className="w-44 px-3 py-2.5">
          {hasSources ? (
            <div className="flex w-full flex-col gap-1.5">
              {row.sources.map((src, sIdx) => (
                <div
                  key={sIdx}
                  className="flex w-full min-w-0 items-start gap-1.5 rounded bg-slate-100 p-2 text-sm leading-snug text-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
                >
                  <FileText className="text-notar-900 mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere] break-words">
                    {src.fileName}
                    {src.pageNumber && src.pageNumber > 0 ? ` (S. ${src.pageNumber})` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm italic">Kein Beleg</span>
          )}
        </td>

        {/* Aufklapp-Button */}
        <td className="w-10 min-w-10 px-2 py-2.5 text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors"
            title={isExpanded ? 'Fachdaten einklappen' : 'Fachdaten ausklappen'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </td>
      </tr>

      {/* Ausklappbare Detail-Fachdaten */}
      {isExpanded && (
        <tr
          id={`field-detail-${row.fieldKey}`}
          role="region"
          aria-label={`Details zu ${row.fieldTitle}`}
          className="border-border/70 border-b bg-slate-100/60 dark:bg-slate-900/60"
        >
          <td colSpan={6} className="px-3 py-3 sm:px-4">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 text-base dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="bg-notar-900 h-2.5 w-2.5 rounded-full" />
                  <span className="text-foreground font-semibold">
                    Extrahierte Vertragsdaten ({row.fieldTitle})
                  </span>
                </div>
                <span className="text-muted-foreground text-sm">Geprüft anhand Aktenbestand</span>
              </div>

              {/* Die Fachdaten */}
              <ErrorBoundary
                fallbackTitle={`Details zu ${row.fieldTitle} nicht verfügbar`}
                fallbackDescription="Die spezifischen Detaildaten konnten nicht visualisiert werden."
              >
                <FieldDetailContent fieldKey={row.fieldKey} dossier={dossier} />
              </ErrorBoundary>

              {/* Nachweise & Fundstellen */}
              {hasSources && (
                <div className="space-y-2 border-t border-slate-200/80 pt-2.5 dark:border-slate-800">
                  <span className="text-foreground block text-base font-semibold">
                    Nachweise &amp; Fundstellen im Aktenbestand:
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {row.sources.map((src, sIdx) => {
                      const snippetText = src.snippet || row.source?.snippet;
                      return (
                        <div
                          key={sIdx}
                          className="space-y-1 rounded-md border border-slate-200 bg-white/90 p-3 text-base shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
                        >
                          <div className="text-foreground flex items-center gap-1.5 font-medium">
                            <FileText className="text-notar-900 h-4 w-4 shrink-0" />
                            <span>{src.fileName}</span>
                            {src.pageNumber ? (
                              <span className="text-muted-foreground font-normal">
                                (Seite {src.pageNumber})
                              </span>
                            ) : null}
                          </div>
                          {snippetText ? (
                            <div className="flex items-start gap-1.5 pt-1 text-slate-700 dark:text-slate-300">
                              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                              <p className="font-mono text-sm leading-relaxed italic">
                                &ldquo;{snippetText}&rdquo;
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};
