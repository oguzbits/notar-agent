import { describe, expect, it } from 'vitest';
import { createMockWorkflowRepository } from '@/test/fixtures/mock-repositories';
import { WORKFLOW_STEP_STATUS, WORKFLOW_STEP_TYPES } from '@/types/workflow';
import { DEFAULT_IMMOBILIENKAUF_WORKFLOW } from './default-workflows';
import { syncAnalysisWorkflow } from './sync-analysis-workflow';

const params = {
  workflow: DEFAULT_IMMOBILIENKAUF_WORKFLOW,
  caseId: 'doc-1',
  organizationId: 'a0000000-0000-4000-8000-000000000001',
};

describe('syncAnalysisWorkflow', () => {
  it('legt die Instanz an und schließt Erfassung und Prüfung ab', async () => {
    const repo = createMockWorkflowRepository();

    const instance = await syncAnalysisWorkflow(repo, params);

    const auditor = params.workflow.steps.find((s) => s.type === WORKFLOW_STEP_TYPES.AUDITOR);
    expect(instance.stepStates[params.workflow.steps[0]!.id]?.status).toBe(
      WORKFLOW_STEP_STATUS.COMPLETED
    );
    expect(instance.stepStates[auditor!.id]?.status).toBe(WORKFLOW_STEP_STATUS.COMPLETED);
    expect(repo.createInstance).toHaveBeenCalledTimes(1);
  });

  it('nutzt eine vorhandene Instanz weiter, statt eine zweite anzulegen', async () => {
    const repo = createMockWorkflowRepository();
    await syncAnalysisWorkflow(repo, params);
    await syncAnalysisWorkflow(repo, params);

    expect(repo.createInstance).toHaveBeenCalledTimes(1);
  });
});
