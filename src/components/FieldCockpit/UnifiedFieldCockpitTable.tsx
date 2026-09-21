import React, { useState } from 'react';
import {
  extractAllFieldRows,
  getDossierFieldMetrics,
  getDossierReadinessStage,
  READINESS_STAGES,
  STATUS_LABELS_DE,
} from '@/lib/dossier';
import { Dossier, FieldStatus, FIELD_STATUS } from '@/types/dossier';
import { CockpitTableHeader } from './subcomponents/CockpitTableHeader';
import { CockpitTableRow } from './subcomponents/CockpitTableRow';

interface UnifiedFieldCockpitTableProps {
  dossier: Dossier;
  onOverrideFieldStatus?: (
    fieldKey: string,
    newStatus: FieldStatus,
    note?: string,
    overrideReason?: string
  ) => void;
  updatingFieldKey?: string | null;
}

export const UnifiedFieldCockpitTable: React.FC<UnifiedFieldCockpitTableProps> = ({
  dossier,
  onOverrideFieldStatus,
  updatingFieldKey,
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
  const metrics = getDossierFieldMetrics(dossier);
  const summary = dossier.executiveSummary || '';

  const missingOrReviewRows = allRows.filter((r) => r.status !== FIELD_STATUS.VERIFIED);

  const openInquiriesCount = Array.isArray(dossier.inquiries)
    ? dossier.inquiries.filter((inq) => !inq.resolved).length
    : 0;

  return (
    <div className="space-y-2.5 text-base">
      {/* 1. Pflichtfelder-Zähler & Begleithinweise (kein doppelter Vorgangs-Status) */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-base font-medium">
            {metrics.isAllVerified
              ? 'Alle 10 Pflichtfelder belegt'
              : `${metrics.verifiedCount}/${metrics.total} Pflichtfelder belegt (${metrics.pendingCount} ausstehend)`}
          </span>

          {metrics.isAllVerified && openInquiriesCount > 0 && (
            <>
              <span className="text-muted-foreground text-sm">•</span>
              <span className="text-muted-foreground text-sm">
                Notarielle Vollzugshinweise &amp; Begleitpunkte unten beachten
              </span>
            </>
          )}
        </div>

        {missingOrReviewRows.length > 0 ? (
          <span className="text-muted-foreground text-sm italic">
            Entwurfsreife erfordert: Alle 10 Pflichtfelder mit Status „Belegt“
          </span>
        ) : (
          <span className="text-notar-900 dark:text-notar-300 inline-flex items-center gap-1 text-sm font-semibold">
            <span>✓ Entwurfsreife erreicht</span>
          </span>
        )}
      </div>

      {/* Reifegrad-Wegweiser: Zeigt konkret, welche Felder noch fehlen */}
      {readiness.stage !== READINESS_STAGES.READY && missingOrReviewRows.length > 0 && (
        <div className="border-border/80 bg-muted/40 rounded-lg border p-3.5">
          <div className="flex items-start gap-3">
            <span className="bg-foreground text-background text-2xs mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold">
              !
            </span>
            <div className="space-y-2">
              <p className="text-foreground text-base leading-relaxed">
                Damit dieser Vorgang{' '}
                <strong className="text-notar-900 dark:text-notar-300 font-bold">
                  „Entwurfsreif“
                </strong>{' '}
                wird, müssen folgende {missingOrReviewRows.length} Felder geklärt und auf{' '}
                <span className="border-notar-400 bg-notar-200 text-notar-950 inline-flex items-center rounded border px-2 py-0.5 text-sm font-semibold">
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
                    className="border-border bg-card text-foreground hover:bg-muted/70 inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1 text-sm font-semibold shadow-2xs transition-colors"
                    title={`Zu „${r.fieldTitle}“ springen / Details anzeigen`}
                  >
                    <span>{r.fieldTitle}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      ({STATUS_LABELS_DE[r.status]})
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
            <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full"></span>
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
                    <span className="text-foreground">{sentence}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-foreground leading-snug">{summary}</p>
          )}
        </div>
      )}

      {/* 3. DIE ZENTRALE PFLICHTFELDER-TABELLE (Cockpit & Prüfbericht vereint) */}
      <div className="border-border bg-card overflow-x-auto rounded-lg border shadow-xs">
        <table className="w-full min-w-full table-fixed text-left text-base">
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
                updatingFieldKey={updatingFieldKey}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
