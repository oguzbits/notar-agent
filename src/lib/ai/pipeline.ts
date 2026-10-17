import { generateText, LanguageModel, SystemModelMessage } from 'ai';
import { parseAuditorOutput } from '@/lib/ai/auditor-output';
import { mergeDossierStages } from '@/lib/ai/dossier-merger';
import { cleanAndParseJson } from '@/lib/ai/parsers/clean-json';
import { assembleExtractionPromptParts } from '@/lib/ai/payload-assembler';
import { downgradeUnvalidatedFields, SourceDocumentText } from '@/lib/ai/verifiable-fact-checker';
import { runNotaryVerification } from '@/lib/ai/verification-engine';
import { normalizeDossier } from '@/lib/dossier';
import {
  formatKnowledgeForPrompt,
  selectApplicableKnowledge,
} from '@/lib/knowledge/rules/rule-selector';
import { errorClassOf, logEvent, timed } from '@/lib/observability/logger';
import { getKnowledgeRepository } from '@/lib/supabase/server';
import { DEFAULT_WORKFLOWS_BY_CASE_TYPE } from '@/lib/workflow/default-workflows';
import {
  CaseType,
  Dossier,
  FIELD_STATUS,
  GenericFieldDossier,
  NOTAR_DOCUMENT_TYPES,
  OverallStatus,
  UploadedFilePayload,
} from '@/types/dossier';
import { LLM_USAGE_STAGES, StageUsageHandler } from '@/types/llm-usage';
import { ExtractionStageOutputSchema } from '@/types/pipeline';
import { WORKFLOW_STEP_TYPES } from '@/types/workflow';

function modelIdOf(model: LanguageModel): string {
  return typeof model === 'string' ? model : model.modelId;
}

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
  onStageUsage?: StageUsageHandler;
  onTrace?: (trace: import('@/types/pipeline').PipelineTraceArtifacts) => void;
  knowledgeRepo?: import('@/lib/knowledge/knowledge-repository').IKnowledgeRepository;
}

function formatInternalNotes(
  notes: string,
  existingDossier?: Dossier
): { noteList: string[]; notesSection: string } {
  const noteList = notes
    .split('\n\n')
    .map((n) => n.trim())
    .filter(Boolean);

  if (noteList.length === 0) {
    return { noteList, notesSection: '' };
  }

  const existingNoteCount =
    existingDossier?.detectedDocuments?.filter((d) => d.fileName.toLowerCase().startsWith('notiz'))
      .length || 0;

  const formattedNotes = noteList
    .map((text, i) => `[Notiz #${existingNoteCount + i + 1}]: "${text}"`)
    .join('\n');

  const notesSection = `=== INTERNE NOTIZEN / BEARBEITUNGSVERMERKE DER SACHBEARBEITUNG ===
${formattedNotes}
(WICHTIGE ANWEISUNG FÜR QUELLEN UND DOKUMENTE:
- Belege aus diesen Notizen MÜSSEN als source.fileName prägnant den Bezeichner "Notiz #${existingNoteCount + 1}" (bzw. die entsprechende Nummer) erhalten.
- Jede dieser Notizen MUSS zwingend auch in 'detectedDocuments' als Typ "${NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ}" mit aktuellem Tagesdatum aufgeführt werden.
- Fasse diese Notizen NIEMALS zusammen oder kürze sie ab! Der Text muss exakt 1:1 im vollen Originalwortlaut wiedergegeben werden.)\n\n`;

  return { noteList, notesSection };
}

function extractAuditorModifications(raw: Record<string, unknown>): {
  modifications: Record<string, GenericFieldDossier<Record<string, unknown>>>;
  overallStatus?: OverallStatus;
  executiveSummary?: string;
  caseTitle?: string;
  inquiries?: unknown[];
} {
  const isFullDossier = raw.fields && typeof raw.fields === 'object' && !('modifications' in raw);

  const modifications =
    ((isFullDossier ? raw.fields : raw.modifications) as Record<
      string,
      GenericFieldDossier<Record<string, unknown>>
    >) || {};

  return {
    modifications,
    overallStatus:
      typeof raw.overallStatus === 'string' ? (raw.overallStatus as OverallStatus) : undefined,
    executiveSummary: typeof raw.executiveSummary === 'string' ? raw.executiveSummary : undefined,
    caseTitle: typeof raw.caseTitle === 'string' ? raw.caseTitle : undefined,
    inquiries: Array.isArray(raw.inquiries) ? raw.inquiries : undefined,
  };
}

export interface ExtractionStageParams {
  files: UploadedFilePayload[];
  caseType: CaseType;
  notes: string;
  existingDossier?: Dossier;
  model: LanguageModel;
  extractionInstructions: SystemModelMessage;
  onStep: (step: number, stepDetail: string) => void;
  onUsage?: (usage: PipelineTokenUsage) => void;
  onStageUsage?: StageUsageHandler;
}

export interface ExtractionStageResult {
  parsedExtractionRaw: Record<string, unknown>;
  noteList: string[];
  notesSection: string;
  usage: PipelineTokenUsage;
  extractionTextResult: string;
  validationSuccess: boolean;
}

export interface AuditorStageParams extends Pick<
  PipelineParams,
  | 'caseType'
  | 'model'
  | 'auditorInstructions'
  | 'onStep'
  | 'onUsage'
  | 'onStageUsage'
  | 'onTrace'
  | 'knowledgeRepo'
> {
  stage1Output: Record<string, unknown>;
  notes?: string;
  noteList?: string[];
  notesSection?: string;
  existingDossier?: Dossier;
  organizationId?: string;
  initialUsage?: PipelineTokenUsage;
  extractionTextResult?: string;
  validationSuccess?: boolean;
}

/**
 * Stufe 1: Ingestion & Extraction Agent (Multimodal Payload-Assembly & Faktenverifikation)
 * Kann autark mit eigenem 60s-Budget auf Serverless ausgeführt werden.
 */
export async function runExtractionStage(
  params: ExtractionStageParams
): Promise<ExtractionStageResult> {
  const {
    files,
    caseType,
    notes,
    existingDossier,
    model,
    extractionInstructions,
    onStep,
    onUsage,
    onStageUsage,
  } = params;

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  const activeWorkflow = DEFAULT_WORKFLOWS_BY_CASE_TYPE[caseType];
  const { noteList, notesSection } = formatInternalNotes(notes, existingDossier);

  const step1Title = activeWorkflow.steps[0]?.title || 'Urkunden- & Sachverhaltserfassung';
  onStep(1, `Stufe 1: ${step1Title} läuft...`);

  const fileSourceTexts: SourceDocumentText[] = [];
  const userPromptParts = await assembleExtractionPromptParts({
    files,
    caseType,
    notesSection,
    onSourceText: (doc) => fileSourceTexts.push(doc),
    existingDossier: existingDossier
      ? {
          caseTitle: existingDossier.caseTitle,
          overallStatus: existingDossier.overallStatus,
          detectedDocuments: existingDossier.detectedDocuments,
        }
      : undefined,
  });

  const extractionResult = await timed(
    { event: 'pipeline_stage', stage: LLM_USAGE_STAGES.EXTRACTION, model: modelIdOf(model) },
    () =>
      generateText({
        model,
        instructions: extractionInstructions,
        messages: [
          {
            role: 'user',
            content: userPromptParts,
          },
        ],
        temperature: 0.1,
      })
  );

  if (extractionResult.usage) {
    totalPromptTokens += extractionResult.usage.inputTokens || 0;
    totalCompletionTokens += extractionResult.usage.outputTokens || 0;
    onStageUsage?.({
      stage: LLM_USAGE_STAGES.EXTRACTION,
      model: modelIdOf(model),
      inputTokens: extractionResult.usage.inputTokens || 0,
      outputTokens: extractionResult.usage.outputTokens || 0,
    });
  }

  const extractionTextResult = extractionResult.text;
  let rawExtractionJson: Record<string, unknown> | null = null;
  let parseSyntaxError: string | null = null;

  try {
    rawExtractionJson = cleanAndParseJson<Record<string, unknown>>(extractionTextResult);
  } catch (err: unknown) {
    parseSyntaxError = err instanceof Error ? err.message : 'Syntaxfehler beim Parsen des JSON';
  }

  let validatedExtraction = rawExtractionJson
    ? ExtractionStageOutputSchema.safeParse(rawExtractionJson)
    : null;

  // Self-Correction Reflection Pass (Enterprise-Grade Fault Tolerance)
  if (!validatedExtraction || !validatedExtraction.success) {
    const errorDetails = parseSyntaxError
      ? `JSON-Syntaxfehler: ${parseSyntaxError}`
      : validatedExtraction?.error.issues
          .map((iss) => `- Pfad "${iss.path.join('.')}": ${iss.message}`)
          .join('\n') || 'Unbekannter Schema-Fehler';

    try {
      const repairedResult = await generateText({
        model,
        instructions: extractionInstructions,
        messages: [
          {
            role: 'user',
            content: `KORREKTUR-AUFFORDERUNG: Das zuvor ausgegebene JSON entspricht nicht vollständig dem geforderten Schema.
Folgende Schema-Inkonsistenzen wurden festgestellt:
${errorDetails}

Hier ist das fehlerhafte JSON:
\`\`\`json
${extractionTextResult}
\`\`\`

Bitte korrigiere ausschließlich die Schema-Fehler und gib das vollständige, valide JSON-Objekt ohne Markdown-Formatierung aus.`,
          },
        ],
        temperature: 0.0,
      });

      if (repairedResult.usage) {
        totalPromptTokens += repairedResult.usage.inputTokens || 0;
        totalCompletionTokens += repairedResult.usage.outputTokens || 0;
        onStageUsage?.({
          stage: LLM_USAGE_STAGES.EXTRACTION,
          model: modelIdOf(model),
          inputTokens: repairedResult.usage.inputTokens || 0,
          outputTokens: repairedResult.usage.outputTokens || 0,
        });
      }

      const repairedJson = cleanAndParseJson<Record<string, unknown>>(repairedResult.text);
      const revalidated = ExtractionStageOutputSchema.safeParse(repairedJson);
      if (revalidated.success) {
        rawExtractionJson = repairedJson;
        validatedExtraction = revalidated;
      }
    } catch (reflectionErr: unknown) {
      logEvent({
        level: 'warn',
        event: 'reflexion_fehlgeschlagen',
        stage: LLM_USAGE_STAGES.EXTRACTION,
        errorClass: errorClassOf(reflectionErr),
      });
    }
  }

  const parsedExtractionRaw: Record<string, unknown> = validatedExtraction?.success
    ? validatedExtraction.data
    : rawExtractionJson || {};

  // UNIFIED VERIFICATION & DETERMINISTIC GUARDRAILS
  if (validatedExtraction?.success) {
    // docIndex 0: Die Notiz ist kein Prompt-Dokument und darf nie als „Dokument n“ aufgelöst werden
    const textSources: SourceDocumentText[] = notesSection.trim()
      ? [{ fileName: 'Bearbeitungsnotiz', docIndex: 0, textContent: notesSection }]
      : [];
    textSources.push(...fileSourceTexts);

    const verified = runNotaryVerification({
      stageOutput: validatedExtraction.data,
      sourceDocuments: textSources,
      referenceDate: new Date(),
    });
    parsedExtractionRaw.fields = verified.fields;
  } else {
    // Fail-closed: Ohne gültiges Schema ist nichts prüfbar, also bleibt kein Feld VERIFIED
    if (parsedExtractionRaw.fields !== undefined) {
      parsedExtractionRaw.fields = downgradeUnvalidatedFields(parsedExtractionRaw.fields);
    }
  }

  const usage: PipelineTokenUsage = {
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    totalTokens: totalPromptTokens + totalCompletionTokens,
  };

  if (onUsage) {
    onUsage(usage);
  }

  return {
    parsedExtractionRaw,
    noteList,
    notesSection,
    usage,
    extractionTextResult,
    validationSuccess: validatedExtraction?.success ?? false,
  };
}

/**
 * Stufe 2: Notary Auditor & Reconciler Agent (JIT-Regel-Prüfung & Delta-Reconciliation)
 * Verarbeitet das Stufe-1-Zwischenergebnis mit eigenem 60s-Budget.
 */
export async function runAuditorStage(params: AuditorStageParams): Promise<Dossier> {
  const {
    stage1Output: parsedExtractionRaw,
    caseType,
    existingDossier,
    organizationId,
    model,
    auditorInstructions,
    onStep,
    onUsage,
    onStageUsage,
    onTrace,
    knowledgeRepo: passedKnowledgeRepo,
    initialUsage,
    extractionTextResult,
    validationSuccess,
  } = params;

  let totalPromptTokens = initialUsage?.promptTokens || 0;
  let totalCompletionTokens = initialUsage?.completionTokens || 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const activeWorkflow = DEFAULT_WORKFLOWS_BY_CASE_TYPE[caseType];

  const { noteList, notesSection } =
    params.noteList && params.notesSection !== undefined
      ? { noteList: params.noteList, notesSection: params.notesSection }
      : formatInternalNotes(params.notes || '', existingDossier);

  const step2Title =
    activeWorkflow.steps.find((s) => s.type === WORKFLOW_STEP_TYPES.AUDITOR)?.title ||
    activeWorkflow.steps[1]?.title ||
    'Notarielle Vorprüfung, Fristen & Plausibilisierung';
  onStep(2, `Stufe 2: ${step2Title}...`);

  const knowledgeRepo = passedKnowledgeRepo || getKnowledgeRepository();
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

  const statutoryRules = await knowledgeRepo.getStatutoryRules(organizationId);
  const relevantStatutory = selectApplicableKnowledge(statutoryRules, selectionContext);

  const searchTerms = [caseType, notesSection, ...docNames].filter(Boolean).join(' ');

  const knowledgeResults = await knowledgeRepo.search({
    queryText: searchTerms || caseType,
    organizationId,
    topK: 3,
  });

  const rulesSection = formatKnowledgeForPrompt(relevantStatutory, knowledgeResults);

  const auditorContextPrompt = `Heutiges Bearbeitungsdatum: ${todayStr}
VORGANGSTYP: ${caseType}

Hier ist das vorläufig extrahierte Roh-Dossier aus Stufe 1 (Ingestion & Extraction Agent):
\`\`\`json
${JSON.stringify(parsedExtractionRaw)}
\`\`\`

${notesSection ? `${notesSection}\n` : ''}${rulesSection}
${
  existingDossier
    ? `=== BESTEHENDES VORGANGSDOSSIER VOR DIESER NACHREICHUNG ===
Aktenzeichen / Titel: ${existingDossier.caseTitle}
Bisheriger Gesamtstatus: ${existingDossier.overallStatus}
Bisherige Nachforderungen (Inquiries):
${JSON.stringify(existingDossier.inquiries || [])}
`
    : ''
}
Führe nun die notarielle Endkontrolle, Plausibilisierung und rechtliche Prüfung gemäß deinen Reconciler-Richtlinien durch.
Antworte AUSSCHLIESSLICH mit dem geforderten JSON-Format (entweder als Reconciled Full Dossier oder im Delta-Format unter 'modifications').`;

  const auditorResult = await timed(
    {
      event: 'pipeline_stage',
      stage: LLM_USAGE_STAGES.AUDIT,
      model: modelIdOf(model),
      organizationId,
    },
    () =>
      generateText({
        model,
        instructions: auditorInstructions,
        prompt: auditorContextPrompt,
        temperature: 0.1,
      })
  );

  if (auditorResult.usage) {
    totalPromptTokens += auditorResult.usage.inputTokens || 0;
    totalCompletionTokens += auditorResult.usage.outputTokens || 0;
    onStageUsage?.({
      stage: LLM_USAGE_STAGES.AUDIT,
      model: modelIdOf(model),
      inputTokens: auditorResult.usage.inputTokens || 0,
      outputTokens: auditorResult.usage.outputTokens || 0,
    });
  }

  if (onUsage) {
    onUsage({
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    });
  }

  const { parsedAuditorRaw, failClosedStatus } = parseAuditorOutput(auditorResult.text);

  const auditorExtraction = extractAuditorModifications(parsedAuditorRaw);

  const mergedDossier = mergeDossierStages({
    caseType,
    existingDossier,
    parsedExtractionRaw,
    parsedAuditorModifications: auditorExtraction.modifications,
    // Fail-closed: Ohne gültiges Auditor-Ergebnis gilt der Vorgang nie als freigegeben
    auditorOverallStatus: failClosedStatus ?? auditorExtraction.overallStatus,
    auditorExecutiveSummary: auditorExtraction.executiveSummary,
    auditorCaseTitle: auditorExtraction.caseTitle,
    auditorInquiries: auditorExtraction.inquiries,
  });

  const finalDossier = normalizeDossier(mergedDossier, noteList);

  if (onTrace) {
    const diffList: Array<{
      fieldKey: string;
      beforeStatus?: string;
      afterStatus?: string;
      reason: string;
    }> = [];

    const extractionFields = (parsedExtractionRaw?.fields || {}) as Record<
      string,
      { status?: string; note?: string }
    >;
    for (const [key, mod] of Object.entries(auditorExtraction.modifications)) {
      const beforeStatus = extractionFields[key]?.status;
      const afterStatus = (mod as { status?: string }).status;
      const reason =
        (mod as { note?: string }).note || 'Status oder Daten vom Notar-Auditor präzisiert';
      diffList.push({
        fieldKey: key,
        beforeStatus,
        afterStatus,
        reason,
      });
    }

    onTrace({
      stage2Knowledge: {
        selectedRules: relevantStatutory.map((r) => r.title || r.id),
        knowledgePromptSnippet: rulesSection.substring(0, 1500),
      },
      stage3Extraction: {
        rawOutputText: extractionTextResult || '',
        parsedJson: parsedExtractionRaw,
        validationSuccess: validationSuccess ?? true,
      },
      stage4Auditor: {
        rawOutputText: auditorResult.text,
        parsedJson: parsedAuditorRaw,
        modifications: auditorExtraction.modifications,
        reasoningDiff: diffList,
      },
      stage5FinalDossier: {
        overallStatus: finalDossier.overallStatus,
        readinessScore: (() => {
          const fieldEntries = Object.values(finalDossier.fields || {});
          if (fieldEntries.length === 0) return 0;
          const verified = fieldEntries.filter((f) => f.status === FIELD_STATUS.VERIFIED).length;
          return Math.round((verified / fieldEntries.length) * 100);
        })(),
        detectedDocumentsCount: finalDossier.detectedDocuments?.length || 0,
        fieldsCount: Object.keys(finalDossier.fields || {}).length,
      },
    });
  }

  return finalDossier;
}

/**
 * Orchestriert den 2-Stufen-KI-Lauf für Urkundenprüfung:
 * 1. Stufe: Ingestion & Extraction Agent (Multimodal mit Dual-Stream Textlayer)
 * 2. Stufe: Notary Auditor & Reconciler Agent (JIT-Regel-Prüfung & Delta-Reconciliation)
 */
export async function runAnalysisPipeline(params: PipelineParams): Promise<Dossier> {
  const extractionResult = await runExtractionStage(params);
  return runAuditorStage({
    ...params,
    stage1Output: extractionResult.parsedExtractionRaw,
    noteList: extractionResult.noteList,
    notesSection: extractionResult.notesSection,
    initialUsage: extractionResult.usage,
    extractionTextResult: extractionResult.extractionTextResult,
    validationSuccess: extractionResult.validationSuccess,
  });
}
