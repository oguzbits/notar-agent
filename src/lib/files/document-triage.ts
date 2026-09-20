import {
  DOCUMENT_RELIABILITY,
  DocumentReliability,
  NOTAR_DOCUMENT_TYPES,
  NotarDocumentType,
} from '@/types/dossier';

export { NOTAR_DOCUMENT_TYPES };
export type { NotarDocumentType };

export interface DocumentTriageResult {
  fileName: string;
  documentType: NotarDocumentType;
  reliability: DocumentReliability;
  detectedDate?: string;
  confidenceScore: number; // 0.0 bis 1.0
  summary: string;
}

/**
 * Normalisiert Textausschnitte für Keyword- und Muster-Scans.
 */
function normalizeSnippet(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Versucht ein ISO- oder DIN-Datum (JJJJ-MM-TT oder TT.MM.JJJJ) aus dem Textlayer zu extrahieren.
 */
function extractFirstDate(text: string): string | undefined {
  // DIN: TT.MM.JJJJ
  const dinMatch = text.match(/\b(0?[1-9]|[12][0-9]|3[01])\.(0?[1-9]|1[012])\.(20\d\d|19\d\d)\b/);
  if (dinMatch && dinMatch[1] && dinMatch[2] && dinMatch[3]) {
    const day = dinMatch[1].padStart(2, '0');
    const month = dinMatch[2].padStart(2, '0');
    const year = dinMatch[3];
    return `${year}-${month}-${day}`;
  }

  // ISO: JJJJ-MM-TT
  const isoMatch = text.match(/\b(20\d\d|19\d\d)-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])\b/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return undefined;
}

/**
 * Deterministische Pre-Flight Dokumenten-Triage.
 * Klassifiziert ein Dokument anhand von Dateiname, Endung und den ersten 2.000 Zeichen Text.
 */
export function triageDocument(params: {
  fileName: string;
  textContent?: string;
}): DocumentTriageResult {
  const { fileName, textContent = '' } = params;
  const nameNorm = fileName.toLowerCase();
  const textNorm = normalizeSnippet(textContent.slice(0, 3000));
  const detectedDate = extractFirstDate(textNorm);

  // 1. Notizen
  if (nameNorm.startsWith('notiz') || nameNorm.includes('vermerk')) {
    return {
      fileName,
      documentType: NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ,
      reliability: DOCUMENT_RELIABILITY.LOW,
      detectedDate,
      confidenceScore: 0.95,
      summary: 'Interne Notiz oder Bearbeitungsvermerk der Sachbearbeitung.',
    };
  }

  // 2. Grundbuchauszug (Amtlich, Höchstpriorität)
  const isGrundbuchName = nameNorm.includes('grundbuch') || nameNorm.includes('gband');
  const isGrundbuchContent =
    textNorm.includes('amtsgericht') &&
    (textNorm.includes('grundbuch von') ||
      textNorm.includes('blatt') ||
      textNorm.includes('bestandsverzeichnis') ||
      textNorm.includes('abteilung i'));

  if (isGrundbuchName || isGrundbuchContent) {
    return {
      fileName,
      documentType: NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG,
      reliability: DOCUMENT_RELIABILITY.HIGH,
      detectedDate,
      confidenceScore: isGrundbuchName && isGrundbuchContent ? 0.99 : 0.85,
      summary: 'Amtlicher Grundbuchauszug mit Bestandsverzeichnis und Abteilungen.',
    };
  }

  // 3. Energieausweis (Technischer Nachweis)
  const isEnergieName =
    nameNorm.includes('energie') ||
    nameNorm.includes('bedarfsausweis') ||
    nameNorm.includes('verbrauchsausweis');
  const isEnergieContent =
    textNorm.includes('energieausweis') ||
    textNorm.includes('endenergiebedarf') ||
    textNorm.includes('endenergieverbrauch') ||
    (textNorm.includes('kwh') && textNorm.includes('ausweis'));

  if (isEnergieName || isEnergieContent) {
    return {
      fileName,
      documentType: NOTAR_DOCUMENT_TYPES.ENERGIEAUSWEIS,
      reliability: DOCUMENT_RELIABILITY.HIGH,
      detectedDate,
      confidenceScore: isEnergieName && isEnergieContent ? 0.98 : 0.85,
      summary: 'Gesetzlicher Energieausweis für Wohn- oder Nichtwohngebäude.',
    };
  }

  // 4. Handelsregister / Gesellschaftsregister
  const isRegisterName =
    nameNorm.includes('handelsregister') ||
    nameNorm.includes('registerauszug') ||
    nameNorm.includes('hrb') ||
    nameNorm.includes('hra');
  const isRegisterContent =
    (textNorm.includes('amtsgericht') &&
      (textNorm.includes('hrb') ||
        textNorm.includes('hra') ||
        textNorm.includes('registerblatt'))) ||
    textNorm.includes('chronologischer abdruck') ||
    textNorm.includes('aktueller abdruck');

  if (isRegisterName || isRegisterContent) {
    return {
      fileName,
      documentType: NOTAR_DOCUMENT_TYPES.HANDELSREGISTER,
      reliability: DOCUMENT_RELIABILITY.HIGH,
      detectedDate,
      confidenceScore: 0.95,
      summary: 'Amtlicher Registerauszug (HRB/HRA) zum Vertretungsnachweis juristischer Personen.',
    };
  }

  // 5. Kaufvertragsentwurf / Kaufangebot
  const isVertragName =
    nameNorm.includes('kaufvertrag') ||
    nameNorm.includes('kaufangebot') ||
    nameNorm.includes('entwurf') ||
    nameNorm.includes('angebot');
  const isVertragContent =
    textNorm.includes('kaufvertrag') ||
    textNorm.includes('kaufpreis') ||
    (textNorm.includes('verkäufer') && textNorm.includes('käufer'));

  if (isVertragName || isVertragContent) {
    return {
      fileName,
      documentType: NOTAR_DOCUMENT_TYPES.KAUFVERTRAGSENTWURF,
      reliability: DOCUMENT_RELIABILITY.MEDIUM,
      detectedDate,
      confidenceScore: 0.9,
      summary: 'Vertragsentwurf oder Kaufangebot zur Festlegung von Kaufpreis und Bedingungen.',
    };
  }

  // 6. Mietübersicht / Mietliste
  const isMietName =
    nameNorm.includes('miet') || nameNorm.includes('mieter') || nameNorm.includes('rent');
  const isMietContent =
    textNorm.includes('kaltmiete') ||
    textNorm.includes('nettomiete') ||
    textNorm.includes('mietverhältnis');

  if (isMietName || isMietContent) {
    return {
      fileName,
      documentType: NOTAR_DOCUMENT_TYPES.MIETUEBERSICHT,
      reliability: DOCUMENT_RELIABILITY.MEDIUM,
      detectedDate,
      confidenceScore: 0.85,
      summary: 'Mietvertragsunterlagen oder Mieterliste zu bestehenden Mietverhältnissen.',
    };
  }

  // 7. Fallback / Sonstiges
  return {
    fileName,
    documentType: NOTAR_DOCUMENT_TYPES.SONSTIGES,
    reliability: DOCUMENT_RELIABILITY.MEDIUM,
    detectedDate,
    confidenceScore: 0.5,
    summary: 'Allgemeines Begleitdokument zum Vorgang.',
  };
}

/**
 * Erzeugt einen formatierten Markdown-Abschnitt für den System- oder User-Prompt.
 */
export function formatTriageManifestForPrompt(triageResults: DocumentTriageResult[]): string {
  if (triageResults.length === 0) return '';

  const lines = triageResults.map((r, i) => {
    const dateStr = r.detectedDate ? `, Datum: ${r.detectedDate}` : '';
    return `[Dokument #${i + 1}]: "${r.fileName}" -> Typ: ${r.documentType} (Verlässlichkeit: ${r.reliability}${dateStr})\n   Hinweis: ${r.summary}`;
  });

  return `=== VORAB GEPRÜFTES AKTEN-INHALTSVERZEICHNIS (PRE-FLIGHT TRIAGE) ===\nFolgende Dokumente wurden im Aktenbestand vorab deterministisch verifiziert und typisiert:\n${lines.join('\n')}\n\n(NUTZUNG IM EXTRAKTIONS-PROZESS: Extrahiere Fakten gezielt aus den jeweils dafür zuständigen amtlichen Dokumenttypen!)\n`;
}
