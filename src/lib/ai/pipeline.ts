import { generateText, LanguageModel, SystemModelMessage } from 'ai';
import { mergeDossierStages } from '@/lib/ai/dossier-merger';
import { cleanAndParseJson } from '@/lib/ai/parsers/clean-json';
import { assembleExtractionPromptParts } from '@/lib/ai/payload-assembler';
import { normalizeDossier } from '@/lib/dossier';
import { applyNotaryDomainGuardrails } from '@/lib/knowledge/domain-guardrails';
import {
  formatKnowledgeForPrompt,
  selectApplicableKnowledge,
} from '@/lib/knowledge/rules/rule-selector';
import { getKnowledgeRepository } from '@/lib/supabase/server';
import {
  CaseType,
  Dossier,
  GenericFieldDossier,
  NOTAR_DOCUMENT_TYPES,
  OverallStatus,
  UploadedFilePayload,
} from '@/types/dossier';
import { AuditorStageOutputSchema, ExtractionStageOutputSchema } from '@/types/pipeline';

export interface PipelineTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface PipelineParams {
  files: UploadedFilePayload[];
  caseType: CaseType;
  notes: string;
  organizationId?: string;
  existingDossier?: Dossier;
  model: LanguageModel;
  extractionInstructions: SystemModelMessage;
  auditorInstructions: SystemModelMessage;
  onStep: (step: number, stepDetail: string) => void;
  onUsage?: (usage: PipelineTokenUsage) => void;
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
    onUsage,
  } = params;

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

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
- Jede dieser Notizen MUSS zwingend auch in 'detectedDocuments' als Typ "${NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ}" mit aktuellem Tagesdatum aufgeführt werden.
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

  const extractionResult = await generateText({
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

  if (extractionResult.usage) {
    totalPromptTokens += extractionResult.usage.inputTokens || 0;
    totalCompletionTokens += extractionResult.usage.outputTokens || 0;
  }

  const extractionTextResult = extractionResult.text;
  let rawExtractionJson = cleanAndParseJson<Record<string, unknown>>(extractionTextResult);
  let validatedExtraction = ExtractionStageOutputSchema.safeParse(rawExtractionJson);

  // Self-Correction Reflection Pass (Enterprise-Grade Fault Tolerance):
  // Falls das Stufe-1-JSON strukturell invalide ist oder Zod-Fehler wirft,
  // führen wir genau einen gezielten Reflection-Turn durch, um die Integrität zu reparieren.
  if (!validatedExtraction.success) {
    const errorDetails = validatedExtraction.error.issues
      .map((iss) => `- Pfad "${iss.path.join('.')}": ${iss.message}`)
      .join('\n');

    try {
      const repairedResult = await generateText({
        model,
        instructions: extractionInstructions,
        messages: [
          {
            role: 'user',
            content: userPromptParts,
          },
          {
            role: 'assistant',
            content: extractionTextResult,
          },
          {
            role: 'user',
            content: `KORREKTUR-AUFFORDERUNG: Das zuvor ausgegebene JSON entspricht nicht vollständig dem geforderten Schema.
Folgende Schema-Inkonsistenzen wurden festgestellt:
${errorDetails}

Bitte korrigiere die Struktur und gib das vollständige, valide JSON-Objekt ohne Markdown-Ummantelung aus.`,
          },
        ],
        temperature: 0.0,
      });

      if (repairedResult.usage) {
        totalPromptTokens += repairedResult.usage.inputTokens || 0;
        totalCompletionTokens += repairedResult.usage.outputTokens || 0;
      }

      const repairedJson = cleanAndParseJson<Record<string, unknown>>(repairedResult.text);
      const revalidated = ExtractionStageOutputSchema.safeParse(repairedJson);
      if (revalidated.success) {
        rawExtractionJson = repairedJson;
        validatedExtraction = revalidated;
      }
    } catch (reflectionErr: unknown) {
      console.warn(
        '[pipeline] Self-Correction Reflection Pass für Stufe 1 fehlgeschlagen:',
        reflectionErr
      );
    }
  }

  const parsedExtractionRaw: Record<string, unknown> = validatedExtraction.success
    ? validatedExtraction.data
    : rawExtractionJson || {};

  // PRE-AUDIT DETERMINISTIC GUARDRAILS:
  // Fristen (10 Jahre GEG), Arithmetik (Parzellenflächen, Mieten) & Entity-Reconciliation
  // VOR Stufe 2 ausführen, damit der Auditor auf mathematisch verifizierten Daten arbeitet!
  if (parsedExtractionRaw.fields && typeof parsedExtractionRaw.fields === 'object') {
    applyNotaryDomainGuardrails(
      parsedExtractionRaw.fields as Record<
        string,
        GenericFieldDossier<Record<string, unknown>> | undefined
      >,
      { referenceDate: new Date() }
    );
  }

  // =========================================================================
  // STUFE 2: Notary Auditor & Reconciler Agent (JIT-Regel-Retrieval & Delta)
  // =========================================================================
  onStep(2, 'Stufe 2: Notarielle Vorprüfung, Fristen & Plausibilisierung...');

  // C.3 Erweitertes RAG & Gesetzliche Prüfnormen aus IKnowledgeRepository
  const knowledgeRepo = getKnowledgeRepository();
  const rawDocs = parsedExtractionRaw?.detectedDocuments;
  const docNames = Array.isArray(rawDocs)
    ? rawDocs
        .map((d) =>
          d && typeof d === 'object' && 'fileName' in d && typeof d.fileName === 'string'
            ? d.fileName
            : ''
        )
        .filter(Boolean)
    : [];

  const selectionContext = {
    caseType,
    fields: parsedExtractionRaw?.fields as Record<string, unknown> | undefined,
    detectedDocuments: parsedExtractionRaw?.detectedDocuments as
      Array<{ fileName?: string; documentType?: string }> | undefined,
    notes: notesSection,
  };

  const statutoryRules = await knowledgeRepo.getStatutoryRules(params.organizationId);
  const relevantStatutory = selectApplicableKnowledge(statutoryRules, selectionContext);

  const searchTerms = [caseType, notesSection, ...docNames].filter(Boolean).join(' ');

  const knowledgeResults = await knowledgeRepo.search({
    queryText: searchTerms || caseType,
    organizationId: params.organizationId,
    topK: 3,
  });

  const rulesSection = formatKnowledgeForPrompt(relevantStatutory, knowledgeResults);

  const auditorContextPrompt = `Heutiges Bearbeitungsdatum: ${todayStr}
VORGANGSTYP: ${caseType}

Hier ist das vorläufig extrahierte Roh-Dossier aus Stufe 1 (Ingestion & Extraction Agent):
\`\`\`json
${JSON.stringify(parsedExtractionRaw, null, 2)}
\`\`\`

${notesSection ? `${notesSection}\n` : ''}${rulesSection}
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

  const auditorResult = await generateText({
    model,
    instructions: auditorInstructions,
    prompt: auditorContextPrompt,
    temperature: 0.1,
  });

  if (auditorResult.usage) {
    totalPromptTokens += auditorResult.usage.inputTokens || 0;
    totalCompletionTokens += auditorResult.usage.outputTokens || 0;
  }

  if (onUsage) {
    onUsage({
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    });
  }

  const rawAuditorJson = cleanAndParseJson<Record<string, unknown>>(auditorResult.text);
  const validatedAuditor = AuditorStageOutputSchema.safeParse(rawAuditorJson);
  const parsedAuditorRaw = (
    validatedAuditor.success ? validatedAuditor.data : rawAuditorJson || {}
  ) as Record<string, unknown>;

  // Reconciler-Format auflösen (Full Dossier vs. Delta-Modus)
  const isFullDossier =
    parsedAuditorRaw &&
    typeof parsedAuditorRaw === 'object' &&
    'fields' in parsedAuditorRaw &&
    parsedAuditorRaw.fields &&
    typeof parsedAuditorRaw.fields === 'object' &&
    !('modifications' in parsedAuditorRaw);

  const parsedAuditorModifications: Record<
    string,
    GenericFieldDossier<Record<string, unknown>>
  > = isFullDossier
    ? (parsedAuditorRaw.fields as Record<string, GenericFieldDossier<Record<string, unknown>>>)
    : (parsedAuditorRaw?.modifications as Record<
        string,
        GenericFieldDossier<Record<string, unknown>>
      >) || {};

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
