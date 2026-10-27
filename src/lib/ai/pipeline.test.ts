import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { buildKnowledgeSearchText } from '@/lib/knowledge/search-text';
import { CASE_TYPES, FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import { LLM_USAGE_STAGES } from '@/types/llm-usage';
import { formatInternalNotes, runAnalysisPipeline } from './pipeline';

// Mock Supabase Server Knowledge Repository
const mockKnowledgeSearch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({
  getKnowledgeRepository: () => ({
    getStatutoryRules: vi.fn().mockResolvedValue([]),
    search: mockKnowledgeSearch,
  }),
}));

// Mock AI module generateText
const mockGenerateText = vi.fn();
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: (params: unknown) => mockGenerateText(params),
  };
});

describe('runAnalysisPipeline', () => {
  beforeEach(() => {
    mockKnowledgeSearch.mockReset().mockResolvedValue([]);
  });

  it('sucht in der Wissensbasis mit Vorgangstyp, Notizblock und erkannten Dateinamen', async () => {
    mockGenerateText.mockReset();
    mockGenerateText
      .mockResolvedValueOnce({
        text: JSON.stringify({
          caseTitle: 'T',
          overallStatus: OVERALL_STATUS.READY,
          fields: {},
          detectedDocuments: [{ fileName: 'Vollmacht_Kopie.pdf' }],
        }),
      })
      .mockResolvedValue({
        text: JSON.stringify({
          overallStatus: OVERALL_STATUS.READY,
          fields: {},
          reconciliationAuditTrail: [],
        }),
      });

    await runAnalysisPipeline({
      files: [],
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notes: 'Verwalter hat noch nicht zugestimmt.',
      model: {} as never,
      extractionInstructions: { role: 'system', content: 'Extract' },
      auditorInstructions: { role: 'system', content: 'Audit' },
      onStep: () => undefined,
    });

    const queryText = mockKnowledgeSearch.mock.calls[0]?.[0]?.queryText as string;
    expect(queryText).toBe(
      buildKnowledgeSearchText(
        CASE_TYPES.IMMOBILIENKAUF,
        formatInternalNotes('Verwalter hat noch nicht zugestimmt.').notesSection,
        ['Vollmacht_Kopie.pdf']
      )
    );
    expect(queryText).toContain('Verwalter hat noch nicht zugestimmt.');
    expect(queryText).toContain('Vollmacht_Kopie.pdf');
  });

  it('triggers reflection pass when Stage 1 output fails initial schema validation and recovers', async () => {
    let callCount = 0;
    mockGenerateText.mockImplementation(async ({ messages }) => {
      callCount++;
      if (callCount === 1) {
        // First turn: Invalid Stage 1 output (fields is an array instead of object)
        return {
          text: JSON.stringify({
            caseTitle: 'Test Vorgang',
            overallStatus: OVERALL_STATUS.READY,
            fields: ['invalid array format'],
            detectedDocuments: [],
          }),
        };
      }
      if (callCount === 2) {
        // Reflection turn: Model corrects its output with compact token-optimized message
        const lastMsg = messages[messages.length - 1];
        expect(lastMsg?.content).toContain('KORREKTUR-AUFFORDERUNG');
        return {
          text: JSON.stringify({
            caseTitle: 'Test Vorgang Repariert',
            overallStatus: OVERALL_STATUS.READY,
            fields: {
              kaufpreis: {
                value: '500.000 €',
                status: FIELD_STATUS.VERIFIED,
                confidence: 0.95,
              },
            },
            detectedDocuments: [],
          }),
        };
      }
      // Stage 2 Auditor call
      return {
        text: JSON.stringify({
          overallStatus: OVERALL_STATUS.READY,
          fields: {},
          reconciliationAuditTrail: [],
        }),
      };
    });

    const stepCalls: string[] = [];
    const dossier = await runAnalysisPipeline({
      files: [],
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notes: '',
      model: {} as never,
      extractionInstructions: { role: 'system', content: 'Extract' },
      auditorInstructions: { role: 'system', content: 'Audit' },
      onStep: (step, detail) => stepCalls.push(`Step ${step}: ${detail}`),
    });

    expect(callCount).toBe(3); // Turn 1 (fail) + Turn 2 (reflection) + Turn 3 (auditor)
    expect(dossier).toBeDefined();
    expect(dossier.caseTitle).toBe('Test Vorgang Repariert');
    expect(stepCalls).toContain('Step 1: Stufe 1: Urkunden- & Sachverhaltserfassung läuft...');
    expect(stepCalls).toContain(
      'Step 2: Stufe 2: Notarielle Vorprüfung, Fristen & Plausibilisierung...'
    );
  });

  describe('Stage-Logs', () => {
    const validStage1 = JSON.stringify({
      caseTitle: 'Test',
      overallStatus: OVERALL_STATUS.READY,
      fields: {},
      detectedDocuments: [],
    });
    const baseParams = {
      files: [],
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notes: '',
      model: {} as never,
      extractionInstructions: { role: 'system' as const, content: 'Extract' },
      auditorInstructions: { role: 'system' as const, content: 'Audit' },
      onStep: () => {},
    };
    const stageLines = (spy: { mock: { calls: unknown[][] } }) =>
      spy.mock.calls
        .map((c) => JSON.parse(String(c[0])))
        .filter((l) => l.event === 'pipeline_stage');

    afterEach(() => vi.restoreAllMocks());

    it('loggt je Stufe genau ein Ereignis mit Dauer', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      mockGenerateText.mockResolvedValueOnce({ text: validStage1 }).mockResolvedValueOnce({
        text: JSON.stringify({ overallStatus: OVERALL_STATUS.READY, fields: {} }),
      });
      await runAnalysisPipeline(baseParams);
      const lines = stageLines(info);
      expect(lines.map((l) => l.stage)).toEqual([
        LLM_USAGE_STAGES.EXTRACTION,
        LLM_USAGE_STAGES.AUDIT,
      ]);
      expect(lines.every((l) => l.outcome === 'ok' && l.durationMs >= 0)).toBe(true);
    });

    it('loggt den Fehlerfall mit Fehlerklasse ohne Meldungstext und wirft weiter', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGenerateText.mockRejectedValueOnce(new TypeError('Vertrag Müller'));
      await expect(runAnalysisPipeline(baseParams)).rejects.toThrow('Vertrag Müller');
      const lines = stageLines(error);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        stage: LLM_USAGE_STAGES.EXTRACTION,
        outcome: 'fehler',
        errorClass: 'TypeError',
      });
      expect(JSON.stringify(error.mock.calls)).not.toContain('Müller');
    });
  });

  it('meldet den Verbrauch je Modellaufruf (Extraktion und Prüfung)', async () => {
    const valid = {
      caseTitle: 'T',
      overallStatus: OVERALL_STATUS.READY,
      fields: {},
      detectedDocuments: [],
    };
    mockGenerateText
      .mockResolvedValueOnce({
        text: JSON.stringify(valid),
        usage: { inputTokens: 100, outputTokens: 20 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          overallStatus: OVERALL_STATUS.READY,
          fields: {},
          reconciliationAuditTrail: [],
        }),
        usage: { inputTokens: 300, outputTokens: 40 },
      });
    const calls: unknown[] = [];
    await runAnalysisPipeline({
      files: [],
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notes: '',
      model: 'test-modell',
      extractionInstructions: { role: 'system', content: 'Extract' },
      auditorInstructions: { role: 'system', content: 'Audit' },
      onStep: () => {},
      onStageUsage: (u) => calls.push(u),
    });
    expect(calls).toEqual([
      {
        stage: LLM_USAGE_STAGES.EXTRACTION,
        model: 'test-modell',
        inputTokens: 100,
        outputTokens: 20,
      },
      { stage: LLM_USAGE_STAGES.AUDIT, model: 'test-modell', inputTokens: 300, outputTokens: 40 },
    ]);
  });
});

describe('runExtractionStage: Beleg-Prüfung', () => {
  const verifiedField = (docIndex: number, snippet: string) => ({
    value: '450.000 €',
    status: FIELD_STATUS.VERIFIED,
    confidence: 0.9,
    data: {
      amountInFigures: 450000,
      amountInWords: 'vierhundertfünfzigtausend Euro',
      currency: 'EUR',
      previousOffers: [],
      priceEvolutionSummary: '',
      isFinalAgreedPrice: true,
    },
    source: { fileName: `Datei ${docIndex}`, docIndex, snippet },
  });
  const stageOutput = (field: unknown, overallStatus: string = OVERALL_STATUS.READY) =>
    JSON.stringify({
      caseTitle: 'Vorgang',
      overallStatus,
      fields: { kaufpreis: field },
      detectedDocuments: [],
    });
  const files = [
    { name: 'a.txt', type: 'text/plain', size: 10, content: 'Kaufpreis 450.000 Euro' },
    { name: 'b.txt', type: 'text/plain', size: 10, content: 'Lastenfrei übergeben' },
  ];
  const run = async (text: string) => {
    mockGenerateText.mockResolvedValue({ text });
    const { runExtractionStage } = await import('./pipeline');
    return runExtractionStage({
      files,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notes: 'Eilt, bitte vorrangig.',
      model: {} as never,
      extractionInstructions: { role: 'system', content: 'Extract' },
      onStep: () => undefined,
    });
  };
  const statusOf = (result: Awaited<ReturnType<typeof run>>) => {
    const fields = result.parsedExtractionRaw.fields as Record<string, { status: string }>;
    return fields.kaufpreis?.status;
  };

  it('prüft ein Zitat gegen das Dokument mit der Prompt-Nummer, auch wenn eine Notiz vorangeht', async () => {
    const result = await run(stageOutput(verifiedField(1, 'Kaufpreis 450.000 Euro')));
    expect(statusOf(result)).toBe(FIELD_STATUS.VERIFIED);
  });

  it('stuft ein Zitat ab, das nur im anderen Dokument steht', async () => {
    const result = await run(stageOutput(verifiedField(2, 'Kaufpreis 450.000 Euro')));
    expect(statusOf(result)).toBe(FIELD_STATUS.NEEDS_REVIEW);
  });

  it('stuft VERIFIED-Felder ab, wenn die Ausgabe auch nach der Korrektur das Schema verletzt', async () => {
    const result = await run(stageOutput(verifiedField(1, 'Kaufpreis 450.000 Euro'), 'UNGUELTIG'));
    expect(statusOf(result)).toBe(FIELD_STATUS.NEEDS_REVIEW);
  });
});
