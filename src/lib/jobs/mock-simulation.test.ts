import { describe, it, expect, vi } from 'vitest';
import { CASE_TYPES, FIELD_STATUS } from '@/types/dossier';
import { runMockSimulation } from './mock-simulation';

describe('runMockSimulation', () => {
  it('simulates multi-stage notary audit and returns structured dossier with step notifications', async () => {
    const steps: Array<{ step: number; detail: string }> = [];
    const handleStep = vi.fn((step: number, detail: string) => {
      steps.push({ step, detail });
    });

    const result = await runMockSimulation({
      files: [{ name: 'vertrag.txt', size: 1024 }],
      notes: 'Test Kaufvertrag',
      onStep: handleStep,
      stepDelayMs: 10, // Fast for unit tests
    });

    expect(handleStep).toHaveBeenCalledTimes(6);
    expect(steps[0]?.step).toBe(1);
    expect(steps[2]?.step).toBe(2);
    expect(steps[5]?.step).toBe(3);
    expect(result.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
    expect(result.caseTitle).toBe('Test Kaufvertrag');
    expect(result.fields.verkaeufer.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.fields.energieausweis.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(result.detectedDocuments.length).toBe(1);
    expect(result.inquiries.length).toBe(1);
  });
});
