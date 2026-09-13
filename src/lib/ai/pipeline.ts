import { generateText, LanguageModel, SystemModelMessage } from 'ai';
import { mergeDossierStages } from '@/lib/ai/dossier-merger';
import { cleanAndParseJson } from '@/lib/ai/parsers/clean-json';
import { assembleExtractionPromptParts, UploadedFilePayload } from '@/lib/ai/payload-assembler';
import { normalizeDossier } from '@/lib/dossier';
import {
  formatRulesForPrompt,
  selectRelevantAuditRules,
} from '@/lib/knowledge/rules/rule-selector';
import { CaseType, Dossier, OverallStatus } from '@/types/dossier';

export type { UploadedFilePayload };

export interface PipelineParams {
  files: UploadedFilePayload[];
  caseType: CaseType;
  notes: string;
  existingDossier?: Dossier;
  model: LanguageModel;
  extractionInstructions: SystemModelMessage;
  auditorInstructions: SystemModelMessage;
  onStep: (step: number, stepDetail: string) => void;
}

/**
 * Orchestriert den 2-Stufen-KI-Lauf für Urkundenprüfung:
 * 1. Stufe: Ingestion & Extraction Agent (Multimodal mit Dual-Stream Textlayer)
 * 2. Stufe: Notary Auditor & Reconciler Agent (JIT-Regel-Prüfung & Delta-Reconciliation)
 */
export async function runAnalysisPipeline(params: PipelineParams): Promise<Dossier> {
  const {
    files,
    caseType,
    notes,
    existingDossier,
    model,
    extractionInstructions,
    auditorInstructions,
    onStep,
  } = params;

  const todayStr = new Date().toISOString().split('T')[0];

  const noteList = notes
    .split('\n\n')
    .map((n) => n.trim())
    .filter(Boolean);

  let notesSection = '';
  if (noteList.length > 0) {
    const existingNoteCount =
      existingDossier?.detectedDocuments?.filter((d) =>
        d.fileName.toLowerCase().startsWith('notiz')
      ).length || 0;

    const formattedNotes = noteList
      .map((text, i) => `[Notiz #${existingNoteCount + i + 1}]: "${text}"`)
      .join('\n');

    notesSection = `=== INTERNE NOTIZEN / BEARBEITUNGSVERMERKE DER SACHBEARBEITUNG ===
${formattedNotes}
(WICHTIGE ANWEISUNG FÜR QUELLEN UND DOKUMENTE:
- Belege aus diesen Notizen MÜSSEN als source.fileName prägnant den Bezeichner "Notiz #${existingNoteCount + 1}" (bzw. die entsprechende Nummer) erhalten.
- Jede dieser Notizen MUSS zwingend auch in 'detectedDocuments' als Typ "Bearbeitungsvermerk / Notiz" mit aktuellem Tagesdatum aufgeführt werden.
- Fasse diese Notizen NIEMALS zusammen oder kürze sie ab! Der Text muss exakt 1:1 im vollen Originalwortlaut wiedergegeben werden.)\n\n`;
  }

  // =========================================================================
  // STUFE 1: Ingestion & Extraction Agent (Multimodal Payload-Assembly)
  // =========================================================================
  onStep(1, 'Stufe 1: Urkunden- & Sachverhaltserfassung läuft...');

  const userPromptParts = await assembleExtractionPromptParts({
    files,
    caseType,
    notesSection,
    existingDossier: existingDossier
      ? {
          caseTitle: existingDossier.caseTitle,
          overallStatus: existingDossier.overallStatus,
          detectedDocuments: existingDossier.detectedDocuments,
        }
      : undefined,
  });

  const { text: extractionText } = await generateText({
    model,
    instructions: extractionInstructions,
    messages: [
      {
        role: 'user',
        content: userPromptParts,
      },
    ],
    temperature: 0.1,
  });

  const parsedExtractionRaw = cleanAndParseJson<Record<string, unknown>>(extractionText);

  // =========================================================================
  // STUFE 2: Notary Auditor & Reconciler Agent (JIT-Regel-Retrieval & Delta)
  // =========================================================================
  onStep(2, 'Stufe 2: Notarielle Vorprüfung, Fristen & Plausibilisierung...');

  const relevantRules = selectRelevantAuditRules({
    caseType,
    fields: parsedExtractionRaw?.fields as Record<string, unknown> | undefined,
    detectedDocuments: parsedExtractionRaw?.detectedDocuments as
      Array<{ fileName?: string; documentType?: string }> | undefined,
    notes: notesSection,
  });
  const rulesSection = formatRulesForPrompt(relevantRules);

  const auditorContextPrompt = `Heutiges Bearbeitungsdatum: ${todayStr}
VORGANGSTYP: ${caseType}

Hier ist das vorläufig extrahierte Roh-Dossier aus Stufe 1 (Ingestion & Extraction Agent):
\`\`\`json
${JSON.stringify(parsedExtractionRaw, null, 2)}
\`\`\`

${rulesSection}
${
  existingDossier
    ? `=== BESTEHENDES VORGANGSDOSSIER VOR DIESER NACHREICHUNG ===
Aktenzeichen / Titel: ${existingDossier.caseTitle}
Bisheriger Gesamtstatus: ${existingDossier.overallStatus}
Bisherige Nachforderungen (Inquiries):
${JSON.stringify(existingDossier.inquiries || [], null, 2)}
`
    : ''
}
Führe nun die notarielle Endkontrolle, Plausibilisierung und rechtliche Prüfung gemäß deinen Reconciler-Richtlinien durch.
Antworte AUSSCHLIESSLICH mit dem geforderten JSON-Format (entweder als Reconciled Full Dossier oder im Delta-Format unter 'modifications').`;

  const { text: auditorText } = await generateText({
    model,
    instructions: auditorInstructions,
    prompt: auditorContextPrompt,
    temperature: 0.1,
  });

  const parsedAuditorRaw = cleanAndParseJson<Record<string, unknown>>(auditorText);

  // Reconciler-Format auflösen (Full Dossier vs. Delta-Modus)
  const isFullDossier =
    parsedAuditorRaw &&
    typeof parsedAuditorRaw === 'object' &&
    'fields' in parsedAuditorRaw &&
    parsedAuditorRaw.fields &&
    typeof parsedAuditorRaw.fields === 'object';

  const parsedAuditorModifications = (
    isFullDossier
      ? parsedAuditorRaw.fields
      : parsedAuditorRaw.modifications && typeof parsedAuditorRaw.modifications === 'object'
        ? parsedAuditorRaw.modifications
        : {}
  ) as Record<string, unknown>;

  const auditorOverallStatus =
    typeof parsedAuditorRaw.overallStatus === 'string'
      ? (parsedAuditorRaw.overallStatus as OverallStatus)
      : undefined;

  const auditorExecutiveSummary =
    typeof parsedAuditorRaw.executiveSummary === 'string'
      ? parsedAuditorRaw.executiveSummary
      : undefined;

  const auditorCaseTitle =
    typeof parsedAuditorRaw.caseTitle === 'string' ? parsedAuditorRaw.caseTitle : undefined;

  const auditorInquiries = Array.isArray(parsedAuditorRaw.inquiries)
    ? parsedAuditorRaw.inquiries
    : undefined;

  // =========================================================================
  // MERGE & NORMALIZATION
  // =========================================================================
  const mergedDossier = mergeDossierStages({
    caseType,
    existingDossier,
    parsedExtractionRaw,
    parsedAuditorModifications,
    auditorOverallStatus,
    auditorExecutiveSummary,
    auditorCaseTitle,
    auditorInquiries,
  });

  return normalizeDossier(mergedDossier, noteList);
}
