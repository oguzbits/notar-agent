import { FIELD_STATUS } from '@/types/dossier';
import {
  CITATION_MATCH_STATUS,
  ExtractionFieldsRecord,
  ExtractionStageOutput,
} from '@/types/pipeline';
import { matchCitationSnippet } from './citation-matcher';

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

function verifyCitationField(
  key: string,
  field: NonNullable<ExtractionFieldsRecord[string]>,
  sourceMap: Map<string, string>,
  verificationIssues: VerificationIssue[]
): NonNullable<ExtractionFieldsRecord[string]> {
  if (field.status !== FIELD_STATUS.VERIFIED || !field.source?.fileName || !field.source?.snippet) {
    return { ...field };
  }

  const targetFileName = field.source.fileName.toLowerCase().trim();
  const rawDocText = sourceMap.get(targetFileName);
  if (!rawDocText?.trim()) {
    return { ...field };
  }

  const matchResult = matchCitationSnippet(rawDocText, field.source.snippet);
  if (matchResult.status === CITATION_MATCH_STATUS.NOT_FOUND) {
    verificationIssues.push({
      fieldKey: key,
      fileName: field.source.fileName,
      expectedSnippet: field.source.snippet,
      reason: 'Quellen-Snippet nicht wörtlich im Dokument nachweisbar',
    });

    const existingNote = field.note || '';
    const appendNote =
      'Automatische Verifikation: Quellen-Snippet nicht wörtlich im Dokument nachweisbar';
    return {
      ...field,
      status: FIELD_STATUS.NEEDS_REVIEW,
      note: existingNote ? `${existingNote} (${appendNote})` : appendNote,
    };
  }

  if (matchResult.matchedSnippet && matchResult.status === CITATION_MATCH_STATUS.FUZZY_MATCH) {
    return {
      ...field,
      source: {
        ...field.source,
        snippet: matchResult.matchedSnippet,
      },
    };
  }

  return { ...field };
}

function verifyKaufpreisArithmetic(
  field: ExtractionFieldsRecord[string] | undefined,
  verificationIssues: VerificationIssue[]
): void {
  if (!field || field.status !== FIELD_STATUS.VERIFIED || !field.data) return;

  const rawData = field.data as Record<string, unknown>;
  const statedAmount = Number(rawData.amountInFigures ?? 0);
  const snippetText = field.source?.snippet || '';

  if (statedAmount <= 0 || !snippetText) return;

  const rateMatches = [...snippetText.matchAll(/(?:rate|teilbetrag)\s*(\d+(?:[\.,]\d+)?)/gi)];
  if (rateMatches.length < 2) return;

  const sumRates = rateMatches.reduce((acc, m) => {
    const valStr = m[1]?.replace(/\./g, '').replace(',', '.') || '0';
    const num = parseFloat(valStr);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  if (sumRates > 0 && Math.abs(sumRates - statedAmount) > 1) {
    const reason = `Rechnerische Kaufpreisdiskrepanz: Summe der Raten (${sumRates.toLocaleString('de-DE')} €) weicht vom Gesamtkaufpreis (${statedAmount.toLocaleString('de-DE')} €) ab.`;
    verificationIssues.push({
      fieldKey: 'kaufpreis',
      fileName: field.source?.fileName,
      expectedSnippet: snippetText,
      reason,
    });

    const notePrefix = field.note ? `${field.note} ` : '';
    field.status = FIELD_STATUS.NEEDS_REVIEW;
    field.note = `${notePrefix}${reason}`.trim();
  }
}

function verifyGmbHCapitalArithmetic(
  stammkapitalField: ExtractionFieldsRecord[string] | undefined,
  gesellschafterField: ExtractionFieldsRecord[string] | undefined,
  verificationIssues: VerificationIssue[]
): void {
  if (
    !gesellschafterField ||
    gesellschafterField.status !== FIELD_STATUS.VERIFIED ||
    !gesellschafterField.data
  ) {
    return;
  }

  const gData = gesellschafterField.data as Record<string, unknown>;
  const partners = Array.isArray(gData.partners) ? gData.partners : [];
  if (partners.length === 0) return;

  let nominalTarget = 0;
  if (stammkapitalField?.data && typeof stammkapitalField.data === 'object') {
    const sData = stammkapitalField.data as Record<string, unknown>;
    nominalTarget = Number(sData.nominalCapital ?? 0);
  } else if (gData.totalCapital) {
    nominalTarget = Number(gData.totalCapital);
  }

  if (nominalTarget <= 0) return;

  const sumShares = partners.reduce((acc: number, p: unknown) => {
    const val = Number((p as { shareAmount?: unknown })?.shareAmount ?? 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  if (sumShares > 0 && Math.abs(sumShares - nominalTarget) > 0.01) {
    const reason = `Rechnerische Kapitaldiskrepanz: Summe der Anteile (${sumShares.toLocaleString('de-DE')} €) weicht vom Stammkapital (${nominalTarget.toLocaleString('de-DE')} €) ab.`;
    verificationIssues.push({
      fieldKey: 'gesellschafter',
      fileName: gesellschafterField.source?.fileName,
      expectedSnippet: gesellschafterField.source?.snippet,
      reason,
    });

    const notePrefix = gesellschafterField.note ? `${gesellschafterField.note} ` : '';
    gesellschafterField.status = FIELD_STATUS.NEEDS_REVIEW;
    gesellschafterField.note = `${notePrefix}${reason}`.trim();
  }
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

  const sourceMap = new Map<string, string>();
  for (const doc of sourceDocuments) {
    sourceMap.set(doc.fileName.toLowerCase().trim(), doc.textContent);
  }

  const updatedFields: ExtractionFieldsRecord = {};
  for (const [key, field] of Object.entries(stageOutput.fields)) {
    if (field) {
      updatedFields[key] = verifyCitationField(key, field, sourceMap, verificationIssues);
    }
  }

  verifyKaufpreisArithmetic(updatedFields['kaufpreis'], verificationIssues);
  verifyGmbHCapitalArithmetic(
    updatedFields['stammkapital'],
    updatedFields['gesellschafter'],
    verificationIssues
  );

  return {
    ...stageOutput,
    fields: updatedFields,
    verificationIssues,
  };
}
