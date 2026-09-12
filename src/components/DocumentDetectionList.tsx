import React, { useState } from 'react';
import { DetectedDocument } from '@/types/dossier';
import { Calendar, ChevronDown, ChevronUp, FileText, StickyNote } from 'lucide-react';
import { formatDateGerman } from '@/lib/formatters';

interface DocumentDetectionListProps {
  documents: DetectedDocument[];
}

export const DocumentDetectionList: React.FC<DocumentDetectionListProps> = ({ documents }) => {
  // Alle Zeilen (inkl. Notizen) initial eingeklappt starten, interaktiv aufklappbar
  const [expandedRowIndexes, setExpandedRowIndexes] = useState<Set<number>>(
    () => new Set<number>()
  );

  if (!documents || documents.length === 0) {
    return null;
  }

  const toggleRowSummary = (idx: number) => {
    setExpandedRowIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const isAllExpanded = documents.length > 0 && expandedRowIndexes.size === documents.length;

  const toggleAllSummaries = () => {
    if (isAllExpanded) {
      setExpandedRowIndexes(new Set());
    } else {
      const allIdxs = new Set<number>();
      documents.forEach((_, i) => allIdxs.add(i));
      setExpandedRowIndexes(allIdxs);
    }
  };

  return (
    <div className="border-border bg-card overflow-x-auto rounded-lg border shadow-xs">
      <table className="w-full table-auto text-left text-base">
        <thead className="text-muted-foreground border-border border-b bg-slate-50/80 text-sm font-semibold dark:bg-slate-900/50">
          <tr>
            {/* 1. Index */}
            <th className="w-[40px] min-w-[40px] px-2 py-3 text-center">#</th>

            {/* 2. Dokument (Dateiname) */}
            <th className="w-[210px] min-w-[210px] px-3 py-3 leading-tight">Dokument</th>

            {/* 3. Dokumenttyp & Relevanz */}
            <th className="w-[150px] min-w-[150px] px-3 py-3 whitespace-nowrap">Dokumenttyp</th>

            {/* 4. Flexible Hauptspalte: Maximale Breite für Inhalt / Zusammenfassung */}
            <th className="min-w-[340px] px-3.5 py-3">Inhalt / Zusammenfassung</th>

            {/* 5. Stand / Umfang */}
            <th className="w-[140px] min-w-[140px] px-3 py-3 text-right whitespace-nowrap">
              Stand / Umfang
            </th>

            {/* 6. Kompakter Klick-Header zum globalen Togglen */}
            <th className="w-[40px] min-w-[40px] px-2 py-3 text-center">
              <button
                type="button"
                onClick={toggleAllSummaries}
                className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center justify-center rounded p-1 transition-colors"
                title={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
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
          {documents.map((doc, idx) => {
            const isNote =
              doc.fileName.toLowerCase().startsWith('notiz') ||
              doc.documentType.toLowerCase().includes('notiz') ||
              doc.documentType.toLowerCase().includes('hinweis');

            const summaryText = doc.summary?.trim() || '';
            const isLongText = summaryText.length > 120;
            const isExpanded = expandedRowIndexes.has(idx);

            const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
              // Wenn Text selektiert wurde, nicht toggeln
              const selection = window.getSelection();
              if (selection && selection.toString().length > 0) {
                return;
              }

              // Wenn auf einen Button, Input oder Link geklickt wurde, nicht Zeile toggeln
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('input') || target.closest('a')) {
                return;
              }

              if (isLongText || isNote) {
                toggleRowSummary(idx);
              }
            };

            return (
              <tr
                key={idx}
                onClick={handleRowClick}
                className={`align-top transition-colors select-text ${
                  isLongText || isNote ? 'cursor-pointer' : ''
                } ${isExpanded ? 'bg-muted/15' : 'hover:bg-muted/30'}`}
              >
                {/* 1. Index */}
                <td className="w-[36px] min-w-[36px] px-1.5 py-2.5 text-center">
                  <span className="bg-muted text-muted-foreground inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold">
                    {idx + 1}
                  </span>
                </td>

                {/* 2. Dokument / Dateiname: kein Truncate, sondern sauberes Wrapping */}
                <td className="w-[200px] min-w-[200px] px-2.5 py-2.5 leading-snug break-words">
                  <div className="flex items-start gap-1.5">
                    {isNote ? (
                      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E08A00]" />
                    ) : (
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#356611]" />
                    )}
                    <span className="text-foreground text-xs font-medium [overflow-wrap:anywhere] sm:text-base">
                      {doc.fileName}
                    </span>
                  </div>
                </td>

                {/* 3. Dokumenttyp & Status */}
                <td className="w-[140px] min-w-[140px] px-2.5 py-2.5 whitespace-nowrap">
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        isNote
                          ? 'border border-amber-300 bg-amber-100 text-amber-900'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {doc.documentType}
                    </span>
                    {doc.reliability === 'UNRELATED' && (
                      <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                        Ohne Vorgangsbezug
                      </span>
                    )}
                    {doc.reliability === 'OBSOLETE' && (
                      <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                        Obsolet
                      </span>
                    )}
                  </div>
                </td>

                {/* 4. Inhalt / Zusammenfassung: Volle Breite, flexibel & ein-/ausklappbar */}
                <td className="px-3 py-2.5 leading-relaxed">
                  {!summaryText ? (
                    <span className="text-muted-foreground text-sm">—</span>
                  ) : isExpanded ? (
                    <div className="space-y-1">
                      {isNote && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-300/80 bg-amber-100/90 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          1:1 Originaltext (ungekürzt)
                        </span>
                      )}
                      <p className="text-foreground/90 font-sans text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap select-text">
                        {summaryText}
                      </p>
                      {(isLongText || isNote) && (
                        <button
                          type="button"
                          onClick={() => toggleRowSummary(idx)}
                          className="inline-block cursor-pointer text-xs font-medium text-[#356611] hover:underline"
                        >
                          Weniger anzeigen
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {isNote && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Notiz gekürzt
                        </span>
                      )}
                      <p
                        className="text-muted-foreground line-clamp-2 text-sm [overflow-wrap:anywhere] select-text"
                        title="Klicken zum vollständigen Aufklappen"
                      >
                        {summaryText}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleRowSummary(idx)}
                        className="inline-block cursor-pointer text-xs font-medium text-[#356611] hover:underline"
                      >
                        Vollständig anzeigen
                      </button>
                    </div>
                  )}
                </td>

                {/* 5. Stand / Umfang */}
                <td className="w-[130px] min-w-[130px] px-2.5 py-2.5 text-right text-xs whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1">
                    <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    <span>{formatDateGerman(doc.date)}</span>
                    {doc.pageCount && !isNote ? (
                      <span className="text-muted-foreground/80 ml-1">({doc.pageCount} S.)</span>
                    ) : null}
                  </div>
                </td>

                {/* 6. Einzelzeilen-Chevron / Toggle */}
                <td className="w-[36px] min-w-[36px] px-2 py-2.5 text-center">
                  {isLongText || isNote ? (
                    <button
                      type="button"
                      onClick={() => toggleRowSummary(idx)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex cursor-pointer items-center justify-center rounded p-1 transition-colors"
                      title={isExpanded ? 'Details einklappen' : 'Details aufklappen'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
