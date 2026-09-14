import { createHash } from 'node:crypto';
import { AuditIntegrityResult, AuditLogEntry } from '@/types/audit';

export const GENESIS_HASH = '0'.repeat(64);

export interface UnhashedAuditPayload {
  documentId: string;
  sequenceNumber: number;
  action: string;
  timestamp: string;
  actor: string;
  previousHash: string;
  details: Record<string, unknown>;
}

/**
 * Erzeugt einen deterministischen SHA-256 Hash aus dem Audit-Payload und dem Vorgänger-Hash.
 * Garantiert kryptografische Manipulationssicherheit durch Chaining.
 */
export function calculateAuditRecordHash(payload: UnhashedAuditPayload): string {
  // Kanonische Serialisierung zur Vermeidung von Eigenschafts-Reihenfolge-Drifts
  const canonicalJson = JSON.stringify({
    documentId: payload.documentId,
    sequenceNumber: payload.sequenceNumber,
    action: payload.action,
    timestamp: payload.timestamp,
    actor: payload.actor,
    previousHash: payload.previousHash,
    details: payload.details,
  });

  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/**
 * Berechnet den SHA-256 Hash über Datei-Inhalte (Text oder Binärpuffer)
 * für den manipulationssicheren Ingestion-Fingerprint.
 */
export function calculateFileFingerprint(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Verifiziert die lückenlose mathematische Integrität einer Kette von Audit-Logs.
 * Stellt sicher, dass:
 * 1. Der Genesis-Eintrag auf GENESIS_HASH zeigt.
 * 2. Jeder nachfolgende Eintrag exakt den previousHash des direkten Vorgängers enthält.
 * 3. Der currentHash jedes Eintrags exakt mit der Neuberechnung aus den Feldern übereinstimmt.
 * 4. Die sequenceNumber streng monoton steigend (0, 1, 2, ...) ist.
 */
export function verifyAuditChain(entries: AuditLogEntry[]): AuditIntegrityResult {
  if (!entries || entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;

    // 1. Sequenznummer-Prüfung
    if (entry.sequenceNumber !== i) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenSequenceIndex: i,
        error: `Invalide Sequenz: Erwartet ${i}, erhalten ${entry.sequenceNumber}.`,
      };
    }

    // 2. Vorgänger-Hash Prüfung
    if (i === 0) {
      if (entry.previousHash !== GENESIS_HASH) {
        return {
          valid: false,
          totalEntries: entries.length,
          brokenSequenceIndex: 0,
          error: `Genesis-Eintrag besitzt ungültigen Vorgänger-Hash: ${entry.previousHash}`,
        };
      }
    } else {
      const prevEntry = entries[i - 1];
      if (!prevEntry || entry.previousHash !== prevEntry.currentHash) {
        return {
          valid: false,
          totalEntries: entries.length,
          brokenSequenceIndex: i,
          error: `Kettenbruch bei Index ${i}: previousHash stimmt nicht mit currentHash des Vorgängers überein.`,
        };
      }
    }

    // 3. Eigene Hash-Neuberechnung (Manipulationsschutz)
    const recalculated = calculateAuditRecordHash({
      documentId: entry.documentId,
      sequenceNumber: entry.sequenceNumber,
      action: entry.action,
      timestamp: entry.timestamp,
      actor: entry.actor,
      previousHash: entry.previousHash,
      details: entry.details,
    });

    if (recalculated !== entry.currentHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenSequenceIndex: i,
        error: `Datenmanipulation bei Index ${i} festgestellt: Hash weicht vom Nutzdateninhalt ab.`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: entries.length,
  };
}
