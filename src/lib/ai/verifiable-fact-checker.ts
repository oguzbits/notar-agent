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

/**
 * Zahlenerkennung mit Unterstützung für deutsche Tausendertrennzeichen (Leerzeichen, Punkt, geschützte Leerzeichen)
 * sowie Dezimalkomma und Dezimalpunkt.
 */
const NUMBER_PATTERN = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*/g;
const DATE_PATTERN = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;

export const numbersOf = (text: string): string[] => {
  const result: string[] = [];
  const matches = text.match(NUMBER_PATTERN) ?? [];
  for (const m of matches) {
    const digits = m.replace(/[^\d]/g, '');
    if (digits) result.push(digits);
  }

  // Zusätzliche Zerlegung deutscher Datumsangaben (z. B. 10.02.2023 -> 10, 02, 2023),
  // damit ISO-Daten (2023-02-10) oder Einzeljahre matchen
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = DATE_PATTERN.exec(text)) !== null) {
    if (dateMatch[1]) result.push(dateMatch[1]);
    if (dateMatch[2]) result.push(dateMatch[2]);
    if (dateMatch[3]) result.push(dateMatch[3]);
  }

  return [...new Set(result)];
};

const MIN_ROUNDED_DIGITS = 2;
const MAX_ROUNDED_SOURCE_DIGITS = 15;
const ROUND_UP_FROM = 5;

function roundedTo(digits: string, count: number): string {
  const head = Number(digits.slice(0, count));
  const up = Number(digits[count]) >= ROUND_UP_FROM ? 1 : 0;
  return String(head + up).replace(/0+$/, '');
}

const withoutTrailingZeros = (digits: string): string => digits.replace(/0+$/, '');

function isOtherUnitOf(figure: string, evidence: string): boolean {
  const significant = withoutTrailingZeros(figure);
  const count = significant.length;
  if (count < MIN_ROUNDED_DIGITS) return false;
  return (
    withoutTrailingZeros(evidence) === significant ||
    (evidence.length > count &&
      evidence.length <= MAX_ROUNDED_SOURCE_DIGITS &&
      roundedTo(evidence, count) === significant)
  );
}

/**
 * Ermittelt alle Ziffernfolgen einer Aussage oder eines Feldes, die in den Belegen nicht vorkommen.
 * Berücksichtigt Einheiten-Umwandlungen (z. B. Tsd. zu voll ausgeschriebener Zahl) und Rundungen.
 */
export function findUnsupportedNumbers(statement: string, evidence: string): string[] {
  const supported = numbersOf(evidence);
  return numbersOf(statement).filter(
    (number) => !supported.some((said) => said === number || isOtherUnitOf(number, said))
  );
}

export function extractDomainTextFromData(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number') return String(data);
  if (Array.isArray(data)) return data.map(extractDomainTextFromData).join(' ');
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .filter(
        ([k]) =>
          !['pageNumber', 'sequenceNumber', 'page', 'id', 'status', 'sharePercent'].includes(k)
      )
      .map(([, v]) => extractDomainTextFromData(v))
      .join(' ');
  }
  return '';
}

export interface ResolvedSourceDocument {
  docIndex: number;
  fileName: string;
  textContent: string;
}

/**
 * Löst Quellendokumente flexibel über docIndex, Kurzschlüssel ([DOC-1], doc_1) oder Dateinamen auf.
 */
export function resolveSourceDocument(
  source: { fileName?: string; docIndex?: number; citationId?: string } | undefined,
  sourceDocuments: SourceDocumentText[]
): ResolvedSourceDocument | undefined {
  if (!source) return undefined;

  // 1. Prioritärer Lookup über expliziten 1-basierten docIndex
  if (typeof source.docIndex === 'number' && source.docIndex > 0) {
    const doc = sourceDocuments[source.docIndex - 1];
    if (doc) {
      return {
        docIndex: source.docIndex,
        fileName: doc.fileName,
        textContent: doc.textContent,
      };
    }
  }

  // 2. Lookup über Dateiname oder Kurzschlüssel (z. B. "[DOC-1]", "doc_1", "Dokument #1", "1")
  const key = (source.citationId || source.fileName || '').trim();
  if (!key) return undefined;

  // Regex-Check auf Kurzschlüssel wie [DOC-1], DOC-1, doc_1, Dokument #1, [Dokument #1] oder reine Ziffer "1"
  const docNumMatch = key.match(
    /(?:(?:\[\s*)?(?:doc|dokument|c)[\s\-_#]*(\d+)(?:\s*\])?)|^(\d+)$/i
  );
  if (docNumMatch) {
    const rawNum = docNumMatch[1] || docNumMatch[2];
    const parsedNum = rawNum ? parseInt(rawNum, 10) : NaN;
    if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum <= sourceDocuments.length) {
      const doc = sourceDocuments[parsedNum - 1];
      if (doc) {
        return {
          docIndex: parsedNum,
          fileName: doc.fileName,
          textContent: doc.textContent,
        };
      }
    }
  }

  // 3. Fallback: Exakter & case-insensitiver Dateinamen-Abgleich
  const lowerKey = key.toLowerCase();
  const foundIdx = sourceDocuments.findIndex((d) => d.fileName.toLowerCase().trim() === lowerKey);
  if (foundIdx !== -1) {
    const doc = sourceDocuments[foundIdx];
    if (doc) {
      return {
        docIndex: foundIdx + 1,
        fileName: doc.fileName,
        textContent: doc.textContent,
      };
    }
  }

  return undefined;
}

function verifyCitationField(
  key: string,
  field: NonNullable<ExtractionFieldsRecord[string]>,
  sourceDocuments: SourceDocumentText[],
  verificationIssues: VerificationIssue[]
): NonNullable<ExtractionFieldsRecord[string]> {
  if (
    field.status !== FIELD_STATUS.VERIFIED ||
    (!field.source?.fileName && !field.source?.docIndex) ||
    !field.source?.snippet
  ) {
    return { ...field };
  }

  const resolved = resolveSourceDocument(field.source, sourceDocuments);
  if (!resolved || !resolved.textContent?.trim()) {
    return { ...field };
  }

  const rawDocText = resolved.textContent;
  const canonicalFileName = resolved.fileName;
  const canonicalDocIndex = resolved.docIndex;

  let updatedField: NonNullable<ExtractionFieldsRecord[string]> = {
    ...field,
    source: {
      ...field.source,
      fileName: canonicalFileName,
      docIndex: canonicalDocIndex,
    },
  };

  const matchResult = matchCitationSnippet(rawDocText, field.source.snippet);
  if (matchResult.status === CITATION_MATCH_STATUS.NOT_FOUND) {
    verificationIssues.push({
      fieldKey: key,
      fileName: canonicalFileName,
      expectedSnippet: field.source.snippet,
      reason: 'Quellen-Snippet nicht wörtlich im Dokument nachweisbar',
    });

    const existingNote = field.note || '';
    const appendNote =
      'Automatische Verifikation: Quellen-Snippet nicht wörtlich im Dokument nachweisbar';
    return {
      ...updatedField,
      status: FIELD_STATUS.NEEDS_REVIEW,
      note: existingNote ? `${existingNote} (${appendNote})` : appendNote,
    };
  }

  if (matchResult.matchedSnippet && matchResult.status === CITATION_MATCH_STATUS.FUZZY_MATCH) {
    updatedField = {
      ...updatedField,
      source: {
        ...updatedField.source,
        snippet: matchResult.matchedSnippet,
      },
    };
  }

  // 2. Deterministischer Zahlen-Check (findUnsupportedNumbers)
  if (field.data) {
    const fieldText = extractDomainTextFromData(field.data);
    if (fieldText) {
      const evidence = `${field.source.snippet} ${rawDocText}`;
      const unsupported = findUnsupportedNumbers(fieldText, evidence);
      if (unsupported.length > 0) {
        const reason = `Nicht belegte Zahlenangabe: Der Wert '${unsupported.join("', '")}' ist im Quellendokument nicht nachweisbar`;
        verificationIssues.push({
          fieldKey: key,
          fileName: canonicalFileName,
          expectedSnippet: field.source.snippet,
          reason,
        });

        const existingNote = updatedField.note || '';
        return {
          ...updatedField,
          status: FIELD_STATUS.NEEDS_REVIEW,
          note: existingNote ? `${existingNote} (${reason})` : reason,
        };
      }
    }
  }

  return updatedField;
}

function verifyKaufpreisArithmetic(
  field: ExtractionFieldsRecord[string] | undefined,
  verificationIssues: VerificationIssue[]
): void {
  if (!field || !field.data) return;

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
  if (!gesellschafterField || !gesellschafterField.data) {
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

  const updatedFields: ExtractionFieldsRecord = {};
  for (const [key, field] of Object.entries(stageOutput.fields)) {
    if (field) {
      updatedFields[key] = verifyCitationField(key, field, sourceDocuments, verificationIssues);
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
