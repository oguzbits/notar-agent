import { describe, expect, it } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import {
  WORKFLOW_ACTORS,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  STEP_CONDITION_OPERATORS,
  WorkflowDefinition,
  WorkflowInstance,
} from '@/types/workflow';
import { evaluateStepCondition, calculateNextStep, validateStepTransition } from './engine';

describe('Workflow Engine - Deterministic Evaluation & Transitions', () => {
  const sampleWorkflow: WorkflowDefinition = {
    id: 'wf_test',
    version: 1,
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    title: 'Test Workflow',
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_1',
        title: 'Extraktion',
        type: WORKFLOW_STEP_TYPES.EXTRACTION,
        actor: WORKFLOW_ACTORS.AGENT,
        action: 'extract',
        isOptional: false,
        description: '',
      },
      {
        id: 'step_gwg',
        title: 'GWG Prüfung',
        type: WORKFLOW_STEP_TYPES.CONDITIONAL_GATE,
        actor: WORKFLOW_ACTORS.AGENT,
        action: 'gwg_check',
        condition: {
          field: 'kaufpreis',
          operator: STEP_CONDITION_OPERATORS.GREATER_THAN,
          value: 1000000,
        },
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

  describe('evaluateStepCondition', () => {
    it('evaluates greater_than correctly', () => {
      const cond = {
        field: 'kaufpreis',
        operator: STEP_CONDITION_OPERATORS.GREATER_THAN,
        value: 1000000,
      };
      expect(evaluateStepCondition(cond, { kaufpreis: 1500000 })).toBe(true);
      expect(evaluateStepCondition(cond, { kaufpreis: 500000 })).toBe(false);
      expect(evaluateStepCondition(cond, { kaufpreis: 1000000 })).toBe(false);
    });

    it('evaluates exists and equals', () => {
      expect(
        evaluateStepCondition(
          { field: 'verwalter', operator: STEP_CONDITION_OPERATORS.EXISTS },
          { verwalter: 'Hausverwaltung Schmidt' }
        )
      ).toBe(true);
      expect(
        evaluateStepCondition({ field: 'verwalter', operator: STEP_CONDITION_OPERATORS.EXISTS }, {})
      ).toBe(false);
      expect(
        evaluateStepCondition(
          { field: 'status', operator: STEP_CONDITION_OPERATORS.EQUALS, value: 'ready' },
          { status: 'ready' }
        )
      ).toBe(true);
    });
  });

  describe('calculateNextStep', () => {
    it('returns first step when instance has no currentStepId', () => {
      const instance: WorkflowInstance = {
        id: 'inst_1',
        workflowDefinitionId: 'wf_test',
        caseId: 'case_1',
        organizationId: 'org_1',
        status: WORKFLOW_INSTANCE_STATUS.PENDING,
        stepStates: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const next = calculateNextStep(sampleWorkflow, instance, {});
      expect(next?.id).toBe('step_1');
    });

    it('skips conditional step if condition is not met', () => {
      const instance: WorkflowInstance = {
        id: 'inst_1',
        workflowDefinitionId: 'wf_test',
        caseId: 'case_1',
        organizationId: 'org_1',
        currentStepId: 'step_1',
        status: WORKFLOW_INSTANCE_STATUS.IN_PROGRESS,
        stepStates: {
          step_1: {
            status: WORKFLOW_STEP_STATUS.COMPLETED,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Kaufpreis unter 1 Mio -> GWG Gate wird übersprungen -> nächster ist Notarfreigabe
      const next = calculateNextStep(sampleWorkflow, instance, { kaufpreis: 400000 });
      expect(next?.id).toBe('step_approval');
    });

    it('executes conditional step if condition is met', () => {
      const instance: WorkflowInstance = {
        id: 'inst_1',
        workflowDefinitionId: 'wf_test',
        caseId: 'case_1',
        organizationId: 'org_1',
        currentStepId: 'step_1',
        status: WORKFLOW_INSTANCE_STATUS.IN_PROGRESS,
        stepStates: {
          step_1: {
            status: WORKFLOW_STEP_STATUS.COMPLETED,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Kaufpreis über 1 Mio -> GWG Gate muss ausgeführt werden
      const next = calculateNextStep(sampleWorkflow, instance, { kaufpreis: 2500000 });
      expect(next?.id).toBe('step_gwg');
    });

    it('returns null when all steps are completed', () => {
      const instance: WorkflowInstance = {
        id: 'inst_1',
        workflowDefinitionId: 'wf_test',
        caseId: 'case_1',
        organizationId: 'org_1',
        currentStepId: 'step_approval',
        status: WORKFLOW_INSTANCE_STATUS.COMPLETED,
        stepStates: {
          step_1: { status: WORKFLOW_STEP_STATUS.COMPLETED },
          step_gwg: { status: WORKFLOW_STEP_STATUS.SKIPPED },
          step_approval: { status: WORKFLOW_STEP_STATUS.COMPLETED },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const next = calculateNextStep(sampleWorkflow, instance, { kaufpreis: 400000 });
      expect(next).toBeNull();
    });
  });

  describe('validateStepTransition', () => {
    it('prevents agent from fulfilling a HUMAN_APPROVAL step', () => {
      const approvalStep = sampleWorkflow.steps[2]!; // Notarfreigabe
      const validation = validateStepTransition(approvalStep, WORKFLOW_ACTORS.AGENT);
      expect(validation.allowed).toBe(false);
      expect(validation.reason).toContain('Notar');
    });

    it('allows notar or sachbearbeiter to approve human steps', () => {
      const approvalStep = sampleWorkflow.steps[2]!; // Notarfreigabe
      const validation = validateStepTransition(approvalStep, WORKFLOW_ACTORS.NOTAR);
      expect(validation.allowed).toBe(true);
    });
  });
});
