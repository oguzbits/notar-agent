import React, { useState } from 'react';
import { Dossier, FieldStatus } from '@/types/dossier';
import { extractAllFieldRows, getDossierReadinessStage } from '@/lib/dossier-helpers';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { StatusBadge } from './StatusBadge';
import { FieldDetailContent } from './FieldDetailContent';
import { FileText, Quote, ChevronDown, ChevronUp, Check, X, Pencil } from 'lucide-react';

interface UnifiedFieldCockpitTableProps {
  dossier: Dossier;
  onOverrideFieldStatus?: (fieldKey: string, newStatus: FieldStatus, note?: string) => void;
}

export const UnifiedFieldCockpitTable: React.FC<UnifiedFieldCockpitTableProps> = ({
  dossier,
  onOverrideFieldStatus,
}) => {
  const [expandedFieldKeys, setExpandedFieldKeys] = useState<Set<string>>(new Set());
  const [editingNoteFieldKey, setEditingNoteFieldKey] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');

  const toggleFieldExpand = (key: string) => {
    setExpandedFieldKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const allRows = extractAllFieldRows(dossier);
  const isAllExpanded = allRows.length > 0 && expandedFieldKeys.size === allRows.length;

  const toggleAllDetails = () => {
    if (isAllExpanded) {
      setExpandedFieldKeys(new Set());
    } else {
      setExpandedFieldKeys(new Set(allRows.map((r) => r.fieldKey)));
    }
  };

  const handleStatusChange = (fieldKey: string, newStatus: FieldStatus) => {
    if (!onOverrideFieldStatus) return;
    const existingRow = allRows.find((r) => r.fieldKey === fieldKey);
    onOverrideFieldStatus(fieldKey, newStatus, existingRow?.note);
  };

  const handleStartEditNote = (fieldKey: string, currentNote: string) => {
    setEditingNoteFieldKey(fieldKey);
    setEditingNoteValue(currentNote);
  };

  const handleSaveNote = (fieldKey: string, currentStatus: FieldStatus) => {
    if (onOverrideFieldStatus) {
      onOverrideFieldStatus(fieldKey, currentStatus, editingNoteValue.trim());
    }
    setEditingNoteFieldKey(null);
  };

  const handleCancelEditNote = () => {
    setEditingNoteFieldKey(null);
    setEditingNoteValue('');
  };

  const editContainerRef = useClickOutside<HTMLDivElement>(handleCancelEditNote, {
    enabled: Boolean(editingNoteFieldKey),
    onEscape: true,
  });

  const readiness = getDossierReadinessStage(dossier);
  const summary = dossier.executiveSummary || '';

  const verifiedRows = allRows.filter((r) => r.status === 'VERIFIED');
  const missingOrReviewRows = allRows.filter((r) => r.status !== 'VERIFIED');

  const openInquiriesCount = Array.isArray(dossier.inquiries)
    ? dossier.inquiries.filter((inq) => !inq.resolved).length
    : 0;

  return (
    <div className="space-y-2.5 text-base">
      {/* 1. Pflichtfelder-Zähler & Begleithinweise (kein doppelter Vorgangs-Status) */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-base font-medium">
            {verifiedRows.length === allRows.length
              ? 'Alle 10 Pflichtfelder belegt'
              : `${verifiedRows.length}/${allRows.length} Pflichtfelder belegt (${missingOrReviewRows.length} ausstehend)`}
          </span>

          {verifiedRows.length === allRows.length && openInquiriesCount > 0 && (
            <>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-muted-foreground text-xs">
                Notarielle Vollzugshinweise &amp; Begleitpunkte unten beachten
              </span>
            </>
          )}
        </div>

        {missingOrReviewRows.length > 0 ? (
          <span className="text-muted-foreground text-xs italic">
            Entwurfsreife erfordert: Alle 10 Pflichtfelder mit Status „Belegt“
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span>✓ Entwurfsreife erreicht</span>
          </span>
        )}
      </div>

      {/* Reifegrad-Wegweiser: Zeigt konkret, welche Felder noch fehlen */}
      {readiness.stage !== 'READY' && missingOrReviewRows.length > 0 && (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              !
            </span>
            <div className="space-y-2">
              <p className="text-base leading-relaxed text-amber-950 dark:text-amber-200">
                Damit dieser Vorgang{' '}
                <strong className="font-semibold text-emerald-800 dark:text-emerald-300">
                  „Entwurfsreif“
                </strong>{' '}
                wird, müssen folgende {missingOrReviewRows.length} Felder geklärt und auf{' '}
                <span className="inline-flex items-center rounded border border-[#B9ED94] bg-[#E7F9DA] px-2 py-0.5 text-xs font-semibold text-[#284E0D]">
                  Belegt
                </span>{' '}
                gesetzt werden:
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {missingOrReviewRows.map((r) => (
                  <button
                    key={r.fieldKey}
                    type="button"
                    onClick={() => toggleFieldExpand(r.fieldKey)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-300 bg-white/90 px-3 py-1 text-sm font-semibold text-amber-900 shadow-2xs transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900/80 dark:text-amber-200"
                    title={`Zu „${r.fieldTitle}“ springen / Details anzeigen`}
                  >
                    <span>{r.fieldTitle}</span>
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                      (
                      {r.status === 'NEEDS_REVIEW'
                        ? 'Prüfung nötig'
                        : r.status === 'MISSING'
                          ? 'Fehlt'
                          : 'Veraltet'}
                      )
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Strukturierte Status-Box (prägnant und platzsparend) */}
      {summary && (
        <div className="bg-muted/40 border-border/60 rounded-lg border px-3 py-2 text-base">
          <div className="text-foreground mb-1 flex items-center gap-1.5 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
            <span>Gesamteinschätzung &amp; Bearbeitungsstand</span>
          </div>
          {summary.includes(';') || summary.includes('. ') ? (
            <ul className="text-muted-foreground space-y-0.5 pl-0.5">
              {summary
                .split(/(?<=[.;])\s+/)
                .map((part) => part.trim())
                .filter(Boolean)
                .map((sentence, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-muted-foreground mt-0.5 select-none">•</span>
                    <span className="text-slate-800 dark:text-slate-200">{sentence}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="leading-snug text-slate-800 dark:text-slate-200">{summary}</p>
          )}
        </div>
      )}

      {/* 3. DIE ZENTRALE PFLICHTFELDER-TABELLE (Cockpit & Prüfbericht vereint) */}
      <div className="border-border bg-card overflow-x-auto rounded-lg border shadow-xs">
        <table className="w-full min-w-[740px] table-fixed text-left text-base">
          <thead className="text-muted-foreground border-border border-b bg-slate-50/80 text-sm font-semibold dark:bg-slate-900/50">
            <tr>
              <th className="w-[40px] min-w-[40px] px-2 py-3 text-center">#</th>
              {/* Spalte etwas breiter für lesbarere Feldtitel */}
              <th className="w-[145px] min-w-[145px] px-3 py-3 leading-tight">Pflichtfeld</th>
              <th className="w-[160px] min-w-[160px] px-4 py-3 whitespace-nowrap">Status</th>
              {/* Flexible Hauptspalte: Nimmt den gesamten verbleibenden Platz ein */}
              <th className="min-w-[280px] px-4 py-3">Befund &amp; Prüfungshinweis</th>
              {/* Quellenspalte: Komfortable 170px für Dateinamen & Seitenzahl */}
              <th className="w-[170px] px-3 py-3">Quelle / Nachweis</th>
              {/* Kompakter Klick-Header: Schmaler Chevron-Button zum globalen Togglen aller Details */}
              <th className="w-[40px] min-w-[40px] px-2 py-3 text-center">
                <button
                  type="button"
                  onClick={toggleAllDetails}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center justify-center rounded p-1 transition-colors focus-visible:ring-2 focus-visible:ring-[#356611]"
                  title={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
                  aria-label={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
                  aria-expanded={isAllExpanded}
                >
                  {isAllExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {allRows.map((row) => {
              const hasSources = row.sources && row.sources.length > 0;
              const isRowExpanded = expandedFieldKeys.has(row.fieldKey);

              const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                // Wenn Text selektiert wurde, nicht toggeln
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                  return;
                }

                // Wenn auf einen Button, Input oder interaktives Element geklickt wurde, nicht Zeile toggeln
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('input') || target.closest('a')) {
                  return;
                }

                toggleFieldExpand(row.fieldKey);
              };

              return (
                <React.Fragment key={row.fieldKey}>
                  <tr
                    onClick={handleRowClick}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isRowExpanded}
                    aria-controls={`field-detail-${row.fieldKey}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleFieldExpand(row.fieldKey);
                      }
                    }}
                    className={`cursor-pointer align-top transition-colors select-text focus-visible:ring-2 focus-visible:ring-[#356611] focus-visible:outline-hidden focus-visible:ring-inset ${
                      isRowExpanded ? 'bg-muted/20' : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Index */}
                    <td className="w-[36px] min-w-[36px] px-1.5 py-2.5 text-center">
                      <span className="bg-muted text-muted-foreground inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold">
                        {row.fieldIndex}
                      </span>
                    </td>

                    {/* Pflichtfeld Name - Bietet mit 140px mehr Platz für längere Titel */}
                    <td className="w-[140px] min-w-[140px] px-2 py-2.5 leading-snug break-words">
                      <span className="text-foreground block font-semibold">{row.fieldTitle}</span>
                    </td>

                    {/* Status mit direkt anklickbarem Dropdown */}
                    <td className="w-[160px] min-w-[160px] px-4 py-2.5 whitespace-nowrap">
                      {onOverrideFieldStatus ? (
                        <div
                          className="relative inline-flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={row.status}
                            onChange={(e) =>
                              handleStatusChange(row.fieldKey, e.target.value as FieldStatus)
                            }
                            className={`cursor-pointer appearance-none rounded-md border py-1.5 pr-6 pl-2.5 text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
                              row.status === 'VERIFIED'
                                ? 'border-[#B9ED94] bg-[#E7F9DA] text-[#284E0D] focus:ring-[#356611]'
                                : row.status === 'NEEDS_REVIEW'
                                  ? 'border-amber-300 bg-amber-50 text-amber-950 focus:ring-amber-500'
                                  : row.status === 'OUTDATED'
                                    ? 'border-orange-300 bg-orange-50 text-orange-950 focus:ring-orange-500'
                                    : 'border-slate-200 bg-slate-100 text-slate-700 focus:ring-slate-400'
                            }`}
                            title="Status dieses Feldes ändern"
                          >
                            <option value="VERIFIED">Belegt</option>
                            <option value="NEEDS_REVIEW">Prüfung nötig</option>
                            <option value="OUTDATED">Veraltet</option>
                            <option value="MISSING">Fehlt</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 opacity-60" />
                        </div>
                      ) : (
                        <StatusBadge status={row.status} size="sm" />
                      )}
                    </td>

                    {/* Befund & Prüfungshinweis – direkt anklickbar zum Bearbeiten */}
                    <td
                      className="space-y-1.5 px-4 py-2.5"
                      onClick={(e) => {
                        if (!editingNoteFieldKey && onOverrideFieldStatus) {
                          e.stopPropagation();
                          handleStartEditNote(row.fieldKey, row.note);
                        }
                      }}
                    >
                      {editingNoteFieldKey === row.fieldKey ? (
                        <div
                          ref={editContainerRef}
                          className="space-y-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea
                            rows={3}
                            value={editingNoteValue}
                            onChange={(e) => setEditingNoteValue(e.target.value)}
                            placeholder="Befund / Prüfungshinweis anpassen..."
                            className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-md border p-2 text-xs focus:ring-2 focus:ring-[#356611] focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveNote(row.fieldKey, row.status)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded bg-[#A2E771] px-2.5 py-1 text-[11px] font-semibold text-[#284E0D] shadow-2xs hover:bg-[#83DF41]"
                            >
                              <Check className="h-3 w-3" />
                              Speichern
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditNote}
                              className="text-muted-foreground hover:text-foreground border-border bg-background inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px]"
                            >
                              <X className="h-3 w-3" />
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative flex items-start justify-between gap-2">
                          <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                            {row.note}
                          </p>
                          {onOverrideFieldStatus && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditNote(row.fieldKey, row.note);
                              }}
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                              title="Befund/Hinweis bearbeiten"
                            >
                              <Pencil className="h-3 w-3 text-slate-500" />
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

                    {/* Quellen / Nachweise - Saubere, lesbare Badges mit 14px Text */}
                    <td className="w-[170px] px-3 py-2.5">
                      {hasSources ? (
                        <div className="flex w-full flex-col gap-1.5">
                          {row.sources.map((src, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex w-full min-w-0 items-start gap-1.5 rounded bg-slate-100 p-2 text-sm leading-snug text-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
                            >
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#356611]" />
                              <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere] break-words">
                                {src.fileName}
                                {src.pageNumber && src.pageNumber > 0
                                  ? ` (S. ${src.pageNumber})`
                                  : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Kein Beleg</span>
                      )}
                    </td>

                    {/* Aufklapp-Button */}
                    <td className="w-[36px] min-w-[36px] px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFieldExpand(row.fieldKey);
                        }}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center justify-center rounded p-1 transition-colors"
                        title={isRowExpanded ? 'Fachdaten einklappen' : 'Fachdaten ausklappen'}
                      >
                        {isRowExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Ausklappbare Detail-Fachdaten (Flurstücke, Eigentümer, Ziffern etc.) + DIREKT integrierte Quellen & Zitate */}
                  {isRowExpanded && (
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
                              <span className="h-2.5 w-2.5 rounded-full bg-[#356611]" />
                              <span className="text-foreground font-semibold">
                                Extrahierte Vertragsdaten ({row.fieldTitle})
                              </span>
                            </div>
                            <span className="text-muted-foreground text-sm">
                              Geprüft anhand Aktenbestand
                            </span>
                          </div>

                          {/* 1. Die Fachdaten */}
                          <ErrorBoundary
                            fallbackTitle={`Details zu ${row.fieldTitle} nicht verfügbar`}
                            fallbackDescription="Die spezifischen Detaildaten konnten nicht visualisiert werden."
                          >
                            <FieldDetailContent fieldKey={row.fieldKey} dossier={dossier} />
                          </ErrorBoundary>

                          {/* 2. Direkt integrierte Quellen & Zitate im Detail-Bereich */}
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
                                        <FileText className="h-4 w-4 shrink-0 text-[#356611]" />
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

                  {/* Ausklappbare Detail-Fachdaten & Quellen */}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
