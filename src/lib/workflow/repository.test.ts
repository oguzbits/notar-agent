import { describe, expect, it, vi } from 'vitest';
import { createMockWorkflowRepository } from '@/test/fixtures/mock-repositories';
import { CASE_TYPES } from '@/types/dossier';
import {
  WORKFLOW_ACTORS,
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  WORKFLOW_STEP_TYPES,
  WorkflowDefinition,
} from '@/types/workflow';
import { SupabaseWorkflowRepository } from './repository';

describe('Workflow Repository - Persistence & State Tracking', () => {
  const sampleWorkflow: WorkflowDefinition = {
    id: 'wf_immo_v1',
    version: 1,
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    title: 'Standard Kaufvertrag Workflow',
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_extraktion',
        title: 'Extraktion',
        type: WORKFLOW_STEP_TYPES.EXTRACTION,
        actor: WORKFLOW_ACTORS.AGENT,
        action: 'extract',
        isOptional: false,
        description: '',
      },
      {
        id: 'step_approval',
        title: 'Notarfreigabe',
        type: WORKFLOW_STEP_TYPES.HUMAN_APPROVAL,
        actor: WORKFLOW_ACTORS.NOTAR,
        action: 'approve',
        isOptional: false,
        description: '',
      },
    ],
  };

  describe('Isolated Mock Fixture (Unit Test Isolation)', () => {
    it('saves and retrieves workflow definitions by case type', async () => {
      const repo = createMockWorkflowRepository();
      await repo.saveDefinition(sampleWorkflow);

      const retrieved = await repo.getDefinitionForCaseType(CASE_TYPES.IMMOBILIENKAUF);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('wf_immo_v1');
      expect(retrieved?.steps).toHaveLength(2);
    });

    it('creates and tracks a workflow instance for a case', async () => {
      const repo = createMockWorkflowRepository();
      await repo.saveDefinition(sampleWorkflow);

      const instance = await repo.createInstance({
        workflowDefinitionId: 'wf_immo_v1',
        caseId: 'case_abc_123',
        organizationId: 'org_test_456',
      });

      expect(instance.caseId).toBe('case_abc_123');
      expect(instance.status).toBe(WORKFLOW_INSTANCE_STATUS.PENDING);
      expect(instance.currentStepId).toBe('step_extraktion');

      const updated = await repo.updateStepState({
        instanceId: instance.id,
        stepId: 'step_extraktion',
        status: WORKFLOW_STEP_STATUS.COMPLETED,
        executedBy: WORKFLOW_ACTORS.AGENT,
      });

      expect(updated.stepStates['step_extraktion']?.status).toBe(WORKFLOW_STEP_STATUS.COMPLETED);
      expect(updated.currentStepId).toBe('step_approval');
    });

    it('triggers audit logger upon step completion', async () => {
      const auditLoggerMock = vi.fn().mockResolvedValue(undefined);
      const repo = createMockWorkflowRepository({ onAuditLog: auditLoggerMock });
      await repo.saveDefinition(sampleWorkflow);

      const instance = await repo.createInstance({
        workflowDefinitionId: 'wf_immo_v1',
        caseId: 'case_abc_123',
        organizationId: 'org_test_456',
      });

      await repo.updateStepState({
        instanceId: instance.id,
        stepId: 'step_extraktion',
        status: WORKFLOW_STEP_STATUS.COMPLETED,
        executedBy: WORKFLOW_ACTORS.AGENT,
      });

      expect(auditLoggerMock).toHaveBeenCalledTimes(1);
      expect(auditLoggerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.any(String),
          caseId: 'case_abc_123',
          stepId: 'step_extraktion',
        })
      );
    });
  });

  describe('SupabaseWorkflowRepository (Fail-Fast Verification)', () => {
    it('throws runtime exception on DB query failure', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Connection refused' },
              }),
            }),
          }),
        }),
      };

      const repo = new SupabaseWorkflowRepository(mockSupabase as never);

      await expect(repo.getDefinition('wf_nonexistent')).rejects.toThrow(
        'Supabase getDefinition error: Connection refused'
      );
    });
  });
});
