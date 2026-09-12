import React, { useState } from 'react';
import { extractAllFieldRows, getDossierReadinessStage } from '@/lib/dossier-helpers';
import { Dossier, FieldStatus } from '@/types/dossier';
import { CockpitTableHeader } from './subcomponents/CockpitTableHeader';
import { CockpitTableRow } from './subcomponents/CockpitTableRow';

interface UnifiedFieldCockpitTableProps {
  dossier: Dossier;
  onOverrideFieldStatus?: (fieldKey: string, newStatus: FieldStatus, note?: string) => void;
}

export const UnifiedFieldCockpitTable: React.FC<UnifiedFieldCockpitTableProps> = ({
  dossier,
  onOverrideFieldStatus,
}) => {
  const [expandedFieldKeys, setExpandedFieldKeys] = useState<Set<string>>(new Set());

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
                <span className="border-notar-400 bg-notar-200 text-notar-950 inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold">
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
          <CockpitTableHeader isAllExpanded={isAllExpanded} onToggleAll={toggleAllDetails} />
          <tbody className="divide-border/60 divide-y">
            {allRows.map((row) => (
              <CockpitTableRow
                key={row.fieldKey}
                row={row}
                dossier={dossier}
                isExpanded={expandedFieldKeys.has(row.fieldKey)}
                onToggleExpand={() => toggleFieldExpand(row.fieldKey)}
                onOverrideFieldStatus={onOverrideFieldStatus}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
