import { describe, it, expect, vi } from 'vitest';
import { CASE_TYPES, FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import { runAnalysisPipeline } from './pipeline';

// Mock Supabase Server Knowledge Repository
vi.mock('@/lib/supabase/server', () => ({
  getKnowledgeRepository: () => ({
    getStatutoryRules: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([]),
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
        // Reflection turn: Model corrects its output
        expect(messages[2]?.content).toContain('KORREKTUR-AUFFORDERUNG');
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
});
