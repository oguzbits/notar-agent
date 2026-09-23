import { describe, expect, it, vi } from 'vitest';
import { createMockWorkflowRepository } from '@/test/fixtures/mock-repositories';
import { CASE_TYPES, OVERALL_STATUS } from '@/types/dossier';
import {
  WORKFLOW_ACTORS,
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  WORKFLOW_STEP_TYPES,
  WorkflowDefinition,
} from '@/types/workflow';
import { executeWorkflowInstance } from './orchestrator';

describe('Workflow Orchestrator - Pipeline Execution & Step Tracking', () => {
  const sampleWorkflow: WorkflowDefinition = {
    id: 'wf_test_pipeline',
    version: 1,
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    title: 'Test Pipeline Workflow',
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_extraktion',
        title: 'Extraktion',
        type: WORKFLOW_STEP_TYPES.EXTRACTION,
        actor: WORKFLOW_ACTORS.AGENT,
        action: 'extract_documents',
        isOptional: false,
        description: '',
      },
      {
        id: 'step_audit',
        title: 'Notarielle Prüfung',
        type: WORKFLOW_STEP_TYPES.AUDITOR,
        actor: WORKFLOW_ACTORS.AGENT,
        action: 'audit_dossier',
        isOptional: false,
        description: '',
      },
      {
        id: 'step_approval',
        title: 'Notarfreigabe',
        type: WORKFLOW_STEP_TYPES.HUMAN_APPROVAL,
        actor: WORKFLOW_ACTORS.NOTAR,
        action: 'approve_dossier',
        isOptional: false,
        description: '',
      },
    ],
  };

  it('runs automated steps and stops at human approval gate', async () => {
    const mockRepo = createMockWorkflowRepository();
    await mockRepo.saveDefinition(sampleWorkflow);

    const instance = await mockRepo.createInstance({
      workflowDefinitionId: 'wf_test_pipeline',
      caseId: 'case_pipeline_123',
      organizationId: 'org_test_789',
    });

    const stepRunner = vi.fn().mockImplementation(async (step) => {
      if (step.id === 'step_extraktion') {
        return { extractedFields: { kaufpreis: 500000 } };
      }
      if (step.id === 'step_audit') {
        return { overallStatus: OVERALL_STATUS.READY };
      }
      return {};
    });

    const result = await executeWorkflowInstance({
      workflowDefinition: sampleWorkflow,
      workflowInstance: instance,
      repository: mockRepo,
      stepRunner,
      contextData: {},
    });

    expect(result.status).toBe(WORKFLOW_INSTANCE_STATUS.IN_PROGRESS);
    expect(result.currentStepId).toBe('step_approval'); // Wartet am Notar-Gate
    expect(result.stepStates['step_extraktion']?.status).toBe(WORKFLOW_STEP_STATUS.COMPLETED);
    expect(result.stepStates['step_audit']?.status).toBe(WORKFLOW_STEP_STATUS.COMPLETED);
    expect(result.stepStates['step_approval']).toBeUndefined(); // Noch nicht ausgeführt
  });
});
