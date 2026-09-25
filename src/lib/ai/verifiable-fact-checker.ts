import { FIELD_STATUS } from '@/types/dossier';
import { ExtractionFieldsRecord, ExtractionStageOutput } from '@/types/pipeline';

export interface SourceDocumentText {
  fileName: string;
  textContent: string;
}

export interface VerificationIssue {
  fieldKey: string;
  expectedSnippet?: string;
  fileName?: string;
  reason: string;
}

export interface VerifyExtractionFactsOptions {
  stageOutput: ExtractionStageOutput;
  sourceDocuments: SourceDocumentText[];
}

export interface VerifyExtractionFactsResult extends ExtractionStageOutput {
  verificationIssues: VerificationIssue[];
}

/**
 * Normalisiert Text für toleranten Snippet-Abgleich (Whitespace & Satzzeichen).
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?"'„“”()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministische Fakten- und Zitationsverifikation (Verifiable Rewards / Fact Checks).
 * Prüft, ob Quellennachweise (Snippets) wörtlich im Originaltext nachweisbar sind.
 * Stuft Felder bei fehlendem Beleg auf NEEDS_REVIEW herab.
 */
export function verifyExtractionFacts(
  options: VerifyExtractionFactsOptions
): VerifyExtractionFactsResult {
  const { stageOutput, sourceDocuments } = options;
  const verificationIssues: VerificationIssue[] = [];

  // Map von normalisiertem Dateinamen auf den Dokumenten-Text
  const sourceMap = new Map<string, string>();
  for (const doc of sourceDocuments) {
    sourceMap.set(doc.fileName.toLowerCase().trim(), doc.textContent);
  }

  const updatedFields: ExtractionFieldsRecord = {};

  for (const [key, field] of Object.entries(stageOutput.fields)) {
    if (!field) continue;

    // Nur verifizierte Felder prüfen, die ein Snippet und einen Dateinamen deklarieren
    if (field.status === FIELD_STATUS.VERIFIED && field.source?.fileName && field.source?.snippet) {
      const targetFileName = field.source.fileName.toLowerCase().trim();
      const rawDocText = sourceMap.get(targetFileName);

      // Falls Textlayer für diese Datei vorhanden ist, wörtliche Existenz prüfen
      if (rawDocText && rawDocText.trim().length > 0) {
        const normalizedDoc = normalizeForComparison(rawDocText);
        const normalizedSnippet = normalizeForComparison(field.source.snippet);

        if (!normalizedDoc.includes(normalizedSnippet)) {
          // Snippet existiert nicht im Original -> Herabstufung
          verificationIssues.push({
            fieldKey: key,
            fileName: field.source.fileName,
            expectedSnippet: field.source.snippet,
            reason: 'Quellen-Snippet nicht wörtlich im Dokument nachweisbar',
          });

          const existingNote = field.note || '';
          const appendNote =
            'Automatische Verifikation: Quellen-Snippet nicht wörtlich im Dokument nachweisbar';
          updatedFields[key] = {
            ...field,
            status: FIELD_STATUS.NEEDS_REVIEW,
            note: existingNote ? `${existingNote} (${appendNote})` : appendNote,
          };
          continue;
        }
      }
    }

    updatedFields[key] = { ...field };
  }

  // =========================================================================
  // ARITHMETISCHE KONSISTENZPRÜFUNGEN (VERIFIABLE FACT CHECKS)
  // =========================================================================

  // 1. Kaufpreis vs. Zahlungsraten im Quellen-Snippet oder Textlayer
  const kaufpreisField = updatedFields['kaufpreis'];
  if (
    kaufpreisField &&
    kaufpreisField.status === FIELD_STATUS.VERIFIED &&
    kaufpreisField.data &&
    typeof kaufpreisField.data === 'object'
  ) {
    const rawData = kaufpreisField.data as Record<string, unknown>;
    const statedAmount = Number(rawData.amountInFigures ?? 0);
    const snippetText = kaufpreisField.source?.snippet || '';

    if (statedAmount > 0 && snippetText) {
      // Suche nach Ratenangaben wie "Erste Rate 200.000 Euro, zweite Rate 200.000 Euro"
      const rateMatches = [...snippetText.matchAll(/(?:rate|teilbetrag)\s*(\d+(?:[\.,]\d+)?)/gi)];
      if (rateMatches.length >= 2) {
        const sumRates = rateMatches.reduce((acc, m) => {
          const valStr = m[1]?.replace(/\./g, '').replace(',', '.') || '0';
          const num = parseFloat(valStr);
          return acc + (isNaN(num) ? 0 : num);
        }, 0);

        if (sumRates > 0 && Math.abs(sumRates - statedAmount) > 1) {
          verificationIssues.push({
            fieldKey: 'kaufpreis',
            fileName: kaufpreisField.source?.fileName,
            expectedSnippet: snippetText,
            reason: `Rechnerische Kaufpreisdiskrepanz: Summe der Raten (${sumRates.toLocaleString('de-DE')} €) weicht vom Gesamtkaufpreis (${statedAmount.toLocaleString('de-DE')} €) ab.`,
          });

          const notePrefix = kaufpreisField.note ? `${kaufpreisField.note} ` : '';
          updatedFields['kaufpreis'] = {
            ...kaufpreisField,
            status: FIELD_STATUS.NEEDS_REVIEW,
            note: `${notePrefix}Rechnerische Kaufpreisdiskrepanz: Summe der Raten (${sumRates.toLocaleString('de-DE')} €) weicht vom Gesamtkaufpreis (${statedAmount.toLocaleString('de-DE')} €) ab.`.trim(),
          };
        }
      }
    }
  }

  // 2. GmbH-Stammkapital vs. Summe der Gesellschafter-Geschäftsanteile
  const stammkapitalField = updatedFields['stammkapital'];
  const gesellschafterField = updatedFields['gesellschafter'];
  if (
    gesellschafterField &&
    gesellschafterField.status === FIELD_STATUS.VERIFIED &&
    gesellschafterField.data &&
    typeof gesellschafterField.data === 'object'
  ) {
    const gData = gesellschafterField.data as Record<string, unknown>;
    const partners = Array.isArray(gData.partners) ? gData.partners : [];

    let nominalTarget = 0;
    if (stammkapitalField?.data && typeof stammkapitalField.data === 'object') {
      const sData = stammkapitalField.data as Record<string, unknown>;
      nominalTarget = Number(sData.nominalCapital ?? 0);
    } else if (gData.totalCapital) {
      nominalTarget = Number(gData.totalCapital);
    }

    if (partners.length > 0 && nominalTarget > 0) {
      const sumShares = partners.reduce((acc: number, p: unknown) => {
        if (p && typeof p === 'object' && 'shareAmount' in p) {
          const val = Number((p as { shareAmount?: unknown }).shareAmount);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0);

      if (sumShares > 0 && Math.abs(sumShares - nominalTarget) > 0.01) {
        verificationIssues.push({
          fieldKey: 'gesellschafter',
          fileName: gesellschafterField.source?.fileName,
          expectedSnippet: gesellschafterField.source?.snippet,
          reason: `Rechnerische Kapitaldiskrepanz: Summe der Anteile (${sumShares.toLocaleString('de-DE')} €) weicht vom Stammkapital (${nominalTarget.toLocaleString('de-DE')} €) ab.`,
        });

        const notePrefix = gesellschafterField.note ? `${gesellschafterField.note} ` : '';
        updatedFields['gesellschafter'] = {
          ...gesellschafterField,
          status: FIELD_STATUS.NEEDS_REVIEW,
          note: `${notePrefix}Rechnerische Kapitaldiskrepanz: Summe der Anteile (${sumShares.toLocaleString('de-DE')} €) weicht vom Stammkapital (${nominalTarget.toLocaleString('de-DE')} €) ab.`.trim(),
        };
      }
    }
  }

  return {
    ...stageOutput,
    fields: updatedFields,
    verificationIssues,
  };
}
