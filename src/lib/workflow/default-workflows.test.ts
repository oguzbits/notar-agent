import { describe, it, expect } from 'vitest';
import { DEFAULT_WORKFLOWS_BY_CASE_TYPE } from './default-workflows';

const workflows = Object.values(DEFAULT_WORKFLOWS_BY_CASE_TYPE);

describe('Standard-Workflows', () => {
  it('enthalten keinen Schritt mit Bedingung, den keine Ausführung auswertet', () => {
    for (const workflow of workflows) {
      expect(workflow.steps.filter((step) => step.condition)).toEqual([]);
    }
  });

  it('nennen keine Schwellen oder Fristen im Anzeigetext (Fachwerte liegen in der Wissensbasis)', () => {
    const schwelle = /\d+(\.\d{3})*\s*(€|Jahre)/;
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        expect(`${step.title} ${step.description}`).not.toMatch(schwelle);
      }
    }
  });
});
