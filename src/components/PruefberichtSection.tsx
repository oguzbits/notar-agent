import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Quote,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import React, { useState } from 'react';
import { extractAllFieldRows, generatePruefberichtText } from '@/lib/dossier-helpers';
import { Dossier } from '@/types/dossier';
import { StatusBadge } from './FieldCockpit/StatusBadge';

interface PruefberichtSectionProps {
  dossier: Dossier;
}

export const PruefberichtSection: React.FC<PruefberichtSectionProps> = ({ dossier }) => {
  const [expandedSnippetKey, setExpandedSnippetKey] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ISSUES'>('ALL');
  const [copied, setCopied] = useState(false);

  const toggleSnippet = (key: string) => {
    setExpandedSnippetKey((prev) => (prev === key ? null : key));
  };

  const handleCopyReport = async () => {
    const text = generatePruefberichtText(dossier);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const allRows = extractAllFieldRows(dossier);
  const issuesCount = allRows.filter((r) => r.status !== 'VERIFIED').length;
  const verifiedCount = allRows.filter((r) => r.status === 'VERIFIED').length;
  const displayedRows =
    filterMode === 'ISSUES' ? allRows.filter((r) => r.status !== 'VERIFIED') : allRows;

  const isReady = dossier.overallStatus === 'READY';
  const summary = dossier.executiveSummary || '';

  return (
    <div className="bg-card text-card-foreground border-border space-y-3 rounded-xl border p-3.5 text-base shadow-xs">
      {/* Kompakte Statusleiste mit Status, Filter und Kopier-Icon */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tracking-wider uppercase ${
              isReady
                ? 'border border-[#B9ED94] bg-[#E7F9DA] text-[#284E0D]'
                : 'border border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            {isReady ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-[#356611]" />
                Entwurfsreif
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                Prüfungsbedarf
              </>
            )}
          </span>

          <span className="text-muted-foreground text-xs">•</span>

          <div className="text-muted-foreground text-xs sm:text-base">
            <span className="font-semibold text-emerald-700">{verifiedCount}</span>
            <span className="text-muted-foreground">/{allRows.length} belegt</span>
            {issuesCount > 0 && (
              <>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="font-semibold text-amber-700">{issuesCount} Klärung nötig</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Schneller Filter: Alle vs. Nur Klärungsbedarf */}
          <div className="bg-muted/80 border-border inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-all ${
                filterMode === 'ALL'
                  ? 'bg-background text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Alle 10 Pflichtfelder
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ISSUES')}
              className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-all ${
                filterMode === 'ISSUES'
                  ? 'bg-background text-foreground font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Nur Klärungsbedarf ({issuesCount})
            </button>
          </div>

          {/* Kopier-Button */}
          <button
            type="button"
            onClick={handleCopyReport}
            className="text-muted-foreground hover:text-foreground hover:bg-muted border-border bg-background inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium shadow-2xs transition-colors"
            title="Prüfbericht & Feststellungen in Zwischenablage kopieren"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[10.5px] font-semibold text-emerald-700">Kopiert</span>
              </>
            ) : (
              <>
                <Copy className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-[11px]">Bericht kopieren</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Strukturierte Status-Box (prägnant und platzsparend) */}
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
                  <li key={idx} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-muted-foreground/60 mt-0.5 text-[10px] select-none">
                      •
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">{sentence}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="leading-snug text-slate-800 dark:text-slate-200">{summary}</p>
          )}
        </div>
      )}

      {/* Tabelle aller Pflichtfelder */}
      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full table-auto text-left text-xs">
          <thead className="text-muted-foreground border-border border-b bg-slate-50/80 text-[11px] font-semibold dark:bg-slate-900/50">
            <tr>
              <th className="w-[48px] px-3 py-2.5 text-center">#</th>
              <th className="w-[140px] px-3 py-2.5 whitespace-nowrap">Pflichtfeld</th>
              <th className="w-[135px] px-3 py-2.5 whitespace-nowrap">Status</th>
              {/* Hauptspalte: Maximale Breite / dehnt sich flexibel aus */}
              <th className="min-w-[320px] px-3 py-2.5">Befund &amp; Prüfungshinweis</th>
              <th className="w-[200px] px-3 py-2.5 whitespace-nowrap">Quelle / Nachweis</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-6 text-center italic">
                  Keine Pflichtfelder mit Klärungsbedarf vorhanden. Alle Pflichtfelder sind belegt.
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => {
                const hasSources = row.sources && row.sources.length > 0;
                const isSnippetOpen = expandedSnippetKey === row.fieldKey;

                return (
                  <React.Fragment key={row.fieldKey}>
                    <tr className="hover:bg-muted/30 align-top transition-colors">
                      {/* Nummer */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="bg-muted text-muted-foreground inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold">
                          {row.fieldIndex}
                        </span>
                      </td>

                      {/* Pflichtfeld Name */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-foreground block font-semibold">
                          {row.fieldTitle}
                        </span>
                      </td>

                      {/* Status - Genug Platz für einzeiliges Badge */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <StatusBadge status={row.status} size="sm" />
                      </td>

                      {/* Befund & Notiz & Handlungsempfehlung - Maximaler Raum */}
                      <td className="space-y-1.5 px-3 py-2.5">
                        <p
                          className={`leading-relaxed ${
                            row.status === 'VERIFIED'
                              ? 'text-slate-600 dark:text-slate-400'
                              : 'font-medium text-slate-900 dark:text-slate-200'
                          }`}
                        >
                          {row.note}
                        </p>
                        {row.actionRequired && (
                          <div className="inline-flex items-start gap-1.5 rounded border border-emerald-200/60 bg-emerald-50/70 px-2 py-1 text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <strong className="shrink-0 font-semibold">Empfehlung:</strong>
                            <span className="leading-snug">{row.actionRequired}</span>
                          </div>
                        )}
                      </td>

                      {/* Quellen / Nachweise */}
                      <td className="px-3 py-2.5">
                        {hasSources ? (
                          <div className="flex flex-col gap-1">
                            {row.sources.map((src, sIdx) => {
                              const snippetKey = `${row.fieldKey}_${sIdx}`;
                              const isThisSnippetOpen =
                                expandedSnippetKey === snippetKey || isSnippetOpen;
                              const hasSnippet = !!(src.snippet || row.source?.snippet);

                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  disabled={!hasSnippet}
                                  onClick={() => hasSnippet && toggleSnippet(snippetKey)}
                                  className={`inline-flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-left text-[10.5px] transition-colors ${
                                    hasSnippet
                                      ? 'cursor-pointer bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                      : 'cursor-default bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400'
                                  }`}
                                  title={hasSnippet ? 'Klicken für Zitatnachweis' : src.fileName}
                                >
                                  <div className="flex min-w-0 items-center gap-1">
                                    <FileText className="h-2.5 w-2.5 shrink-0 text-slate-500" />
                                    <span className="max-w-[130px] truncate font-medium">
                                      {src.fileName}
                                      {src.pageNumber && src.pageNumber > 0
                                        ? ` (S. ${src.pageNumber})`
                                        : ''}
                                    </span>
                                  </div>
                                  {hasSnippet &&
                                    (isThisSnippetOpen ? (
                                      <ChevronUp className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                                    ))}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10.5px] italic">
                            Kein Beleg
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Ausklappbare Textbelege / Zitate unter der Zeile */}
                    {row.sources.map((src, sIdx) => {
                      const snippetKey = `${row.fieldKey}_${sIdx}`;
                      const isOpen =
                        expandedSnippetKey === snippetKey ||
                        (expandedSnippetKey === row.fieldKey && sIdx === 0);
                      const snippetText = src.snippet || row.source?.snippet;

                      if (!isOpen || !snippetText) return null;

                      return (
                        <tr
                          key={`snippet-${snippetKey}`}
                          className="bg-slate-50/70 dark:bg-slate-900/30"
                        >
                          <td colSpan={5} className="px-4 py-2">
                            <div className="bg-background flex items-start gap-2 rounded border border-slate-200/80 p-2 text-[11px] text-slate-700 dark:text-slate-300">
                              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <div className="space-y-0.5">
                                {row.sources.length > 1 && (
                                  <span className="block text-[10px] font-semibold text-slate-500">
                                    Nachweis zu {src.fileName}:
                                  </span>
                                )}
                                <p className="font-mono text-[11px] leading-relaxed text-slate-800 italic dark:text-slate-200">
                                  &ldquo;{snippetText}&rdquo;
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
