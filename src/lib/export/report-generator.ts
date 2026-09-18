import { STATUS_LABELS_DE } from '@/lib/dossier/constants';
import { isDossierEntwurfsreif } from '@/lib/dossier/readiness';
import { extractFieldObservations } from '@/lib/dossier/ui-mapper';
import { Dossier } from '@/types/dossier';

export interface AuditReportOptions {
  history?: Array<{
    action: string;
    timestamp: string;
    actor: string;
    currentHash: string;
    details?: Record<string, unknown>;
  }>;
  integrityValid?: boolean;
}

/**
 * Generiert einen revisionssicheren textuellen Prüfbericht gem. § 17 ff. BeurkG.
 */
export function generatePruefberichtText(
  dossier: Dossier,
  auditOptions?: AuditReportOptions
): string {
  const isReady = isDossierEntwurfsreif(dossier);
  const statusLabel = isReady ? 'ENTWURFSREIF' : 'PRÜFUNGSBEDARF';
  const observations = extractFieldObservations(dossier);

  const lines: string[] = [
    `=== PRÜFBERICHT & FESTSTELLUNGEN (§ 17 ff. BeurkG) ===`,
    `Vorgang: ${dossier.caseTitle}`,
    `Status: ${statusLabel}`,
    `Datum: ${new Date().toLocaleDateString('de-DE')}`,
    ``,
  ];

  if (dossier.executiveSummary) {
    lines.push(`Gesamteinschätzung:`, `${dossier.executiveSummary}`, ``);
  }

  if (observations.length === 0) {
    lines.push(`Feststellungen: Alle Pflichtfelder vollständig belegt.`);
  } else {
    lines.push(`Feststellungen (${observations.length}):`);
    for (const obs of observations) {
      const sourceStr =
        obs.sources.length > 0
          ? obs.sources
              .map((s) => `${s.fileName}${s.pageNumber ? ` (S. ${s.pageNumber})` : ''}`)
              .join('; ')
          : 'Kein Beleg im Aktenbestand';

      const germanStatus = STATUS_LABELS_DE[obs.status] || obs.status;
      lines.push(`[${obs.fieldIndex}] ${obs.fieldTitle} [${germanStatus}]: ${obs.note}`);
      lines.push(`    Quelle: ${sourceStr}`);
      if (obs.actionRequired) {
        lines.push(`    Empfehlung: ${obs.actionRequired}`);
      }
      if (obs.source?.snippet) {
        lines.push(`    Zitat: "${obs.source.snippet}"`);
      }
      lines.push(``);
    }
  }

  // Revisionssicherer Audit-Trail Anhang
  if (auditOptions?.history && auditOptions.history.length > 0) {
    lines.push(`=== REVISIONSSICHERER AUDIT-TRAIL (HASH-CHAINING § 17 BeurkG) ===`);
    lines.push(
      `Integritätsstatus: ${auditOptions.integrityValid ? 'Mathematisch verifiziert (Lückenlos)' : 'Integritätswarnung'}`
    );
    lines.push(`Protokollierte Vorgangsschritte (${auditOptions.history.length}):`);

    auditOptions.history.forEach((event, idx) => {
      lines.push(`[Schritt ${idx + 1}] ${event.action} - ${event.timestamp}`);
      lines.push(`    Akteur: ${event.actor}`);
      lines.push(`    SHA-256 Hash: ${event.currentHash}`);

      const override = event.details?.override as
        { reason?: string; fieldKey?: string; newStatus?: string } | undefined;
      if (override?.reason) {
        lines.push(
          `    Freigabebegründung (${override.fieldKey || 'Feld'} -> ${override.newStatus || ''}): "${override.reason}"`
        );
      }
    });
    lines.push(``);
  }

  return lines.join('\n').trim();
}
