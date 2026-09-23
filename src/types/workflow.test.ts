import { describe, expect, it } from 'vitest';
import { CASE_TYPES } from './dossier';
import {
  WORKFLOW_ACTORS,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  STEP_CONDITION_OPERATORS,
  WorkflowStepConditionSchema,
  WorkflowStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowInstanceSchema,
} from './workflow';

describe('Workflow Contracts (Zod-Schemas)', () => {
  it('validates step condition schema with various operators', () => {
    const condition = {
      field: 'kaufpreis',
      operator: STEP_CONDITION_OPERATORS.GREATER_THAN,
      value: 1000000,
    };
    const parsed = WorkflowStepConditionSchema.safeParse(condition);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.operator).toBe(STEP_CONDITION_OPERATORS.GREATER_THAN);
      expect(parsed.data.value).toBe(1000000);
    }
  });

  it('validates a complete step definition with actor, action and guardrails', () => {
    const step = {
      id: 'step_gwg_check',
      title: 'Geldwäscheprüfung (GWG)',
      type: WORKFLOW_STEP_TYPES.CONDITIONAL_GATE,
      actor: WORKFLOW_ACTORS.AGENT,
      condition: {
        field: 'kaufpreis',
        operator: STEP_CONDITION_OPERATORS.GREATER_THAN,
        value: 1000000,
      },
      action: 'verify_gwg_threshold',
      isOptional: false,
    };
    const parsed = WorkflowStepDefinitionSchema.safeParse(step);
    expect(parsed.success).toBe(true);
  });

  it('validates a full workflow definition for IMMOBILIENKAUF', () => {
    const workflowDef = {
      id: 'wf_immo_standard_v1',
      version: 1,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      title: 'Standardablauf Immobilienkaufvertrag',
      steps: [
        {
          id: 'step_1_ingestion',
          title: 'Dokumentenerfassung & Extraktion',
          type: WORKFLOW_STEP_TYPES.EXTRACTION,
          actor: WORKFLOW_ACTORS.AGENT,
          action: 'extract_documents',
          isOptional: false,
        },
        {
          id: 'step_2_audit',
          title: 'Notarielle Vorprüfung & Plausibilisierung',
          type: WORKFLOW_STEP_TYPES.AUDITOR,
          actor: WORKFLOW_ACTORS.AGENT,
          action: 'audit_dossier',
          isOptional: false,
        },
        {
          id: 'step_3_approval',
          title: 'Notarfreigabe',
          type: WORKFLOW_STEP_TYPES.HUMAN_APPROVAL,
          actor: WORKFLOW_ACTORS.NOTAR,
          action: 'approve_dossier',
          isOptional: false,
        },
      ],
    };

    const parsed = WorkflowDefinitionSchema.safeParse(workflowDef);
    expect(parsed.success).toBe(true);
  });

  it('validates a workflow instance with step execution logs', () => {
    const instance = {
      id: 'wfi_123',
      workflowDefinitionId: 'wf_immo_standard_v1',
      caseId: 'case_456',
      organizationId: 'org_789',
      currentStepId: 'step_2_audit',
      status: WORKFLOW_INSTANCE_STATUS.IN_PROGRESS,
      stepStates: {
        step_1_ingestion: {
          status: WORKFLOW_STEP_STATUS.COMPLETED,
          completedAt: new Date().toISOString(),
          executedBy: WORKFLOW_ACTORS.AGENT,
        },
        step_2_audit: {
          status: WORKFLOW_STEP_STATUS.IN_PROGRESS,
        },
      },
    };

    const parsed = WorkflowInstanceSchema.safeParse(instance);
    expect(parsed.success).toBe(true);
  });
});
