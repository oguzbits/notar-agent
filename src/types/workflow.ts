import { z } from 'zod';
import { CaseTypeSchema } from './dossier';

export const WORKFLOW_STEP_TYPES = {
  INGESTION: 'ingestion',
  EXTRACTION: 'extraction',
  GUARDRAILS: 'guardrails',
  AUDITOR: 'auditor',
  CONDITIONAL_GATE: 'conditional_gate',
  HUMAN_APPROVAL: 'human_approval',
  EXPORT: 'export',
} as const;

export const WorkflowStepTypeSchema = z.enum([
  WORKFLOW_STEP_TYPES.INGESTION,
  WORKFLOW_STEP_TYPES.EXTRACTION,
  WORKFLOW_STEP_TYPES.GUARDRAILS,
  WORKFLOW_STEP_TYPES.AUDITOR,
  WORKFLOW_STEP_TYPES.CONDITIONAL_GATE,
  WORKFLOW_STEP_TYPES.HUMAN_APPROVAL,
  WORKFLOW_STEP_TYPES.EXPORT,
]);
export type WorkflowStepType = z.infer<typeof WorkflowStepTypeSchema>;

export const WORKFLOW_ACTORS = {
  AGENT: 'agent_executor',
  NOTAR: 'notar_executor',
  SACHBEARBEITER: 'sachbearbeiter_executor',
  SYSTEM: 'system_executor',
} as const;

export const WorkflowActorSchema = z.enum([
  WORKFLOW_ACTORS.AGENT,
  WORKFLOW_ACTORS.NOTAR,
  WORKFLOW_ACTORS.SACHBEARBEITER,
  WORKFLOW_ACTORS.SYSTEM,
]);
export type WorkflowActor = z.infer<typeof WorkflowActorSchema>;

export const WORKFLOW_STEP_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_INPUT: 'waiting_for_input',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export const WorkflowStepStatusSchema = z.enum([
  WORKFLOW_STEP_STATUS.PENDING,
  WORKFLOW_STEP_STATUS.IN_PROGRESS,
  WORKFLOW_STEP_STATUS.WAITING_FOR_INPUT,
  WORKFLOW_STEP_STATUS.COMPLETED,
  WORKFLOW_STEP_STATUS.FAILED,
  WORKFLOW_STEP_STATUS.SKIPPED,
]);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

export const WORKFLOW_INSTANCE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_INPUT: 'waiting_for_input',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const WorkflowInstanceStatusSchema = z.enum([
  WORKFLOW_INSTANCE_STATUS.PENDING,
  WORKFLOW_INSTANCE_STATUS.IN_PROGRESS,
  WORKFLOW_INSTANCE_STATUS.WAITING_FOR_INPUT,
  WORKFLOW_INSTANCE_STATUS.COMPLETED,
  WORKFLOW_INSTANCE_STATUS.FAILED,
  WORKFLOW_INSTANCE_STATUS.CANCELLED,
]);
export type WorkflowInstanceStatus = z.infer<typeof WorkflowInstanceStatusSchema>;

export const STEP_CONDITION_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  EXISTS: 'exists',
  NOT_EXISTS: 'not_exists',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  CONTAINS: 'contains',
} as const;

export const StepConditionOperatorSchema = z.enum([
  STEP_CONDITION_OPERATORS.EQUALS,
  STEP_CONDITION_OPERATORS.NOT_EQUALS,
  STEP_CONDITION_OPERATORS.EXISTS,
  STEP_CONDITION_OPERATORS.NOT_EXISTS,
  STEP_CONDITION_OPERATORS.GREATER_THAN,
  STEP_CONDITION_OPERATORS.LESS_THAN,
  STEP_CONDITION_OPERATORS.CONTAINS,
]);
export type StepConditionOperator = z.infer<typeof StepConditionOperatorSchema>;

export const WorkflowStepConditionSchema = z.object({
  field: z.string(),
  operator: StepConditionOperatorSchema,
  value: z.unknown().optional(),
});
export type WorkflowStepCondition = z.infer<typeof WorkflowStepConditionSchema>;

export const WorkflowStepDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: WorkflowStepTypeSchema,
  actor: WorkflowActorSchema,
  action: z.string(),
  condition: WorkflowStepConditionSchema.optional(),
  isOptional: z.boolean().default(false),
  description: z.string().default(''),
});
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>;

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  caseType: CaseTypeSchema,
  title: z.string(),
  steps: z.array(WorkflowStepDefinitionSchema),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export const StepStateSchema = z.object({
  status: WorkflowStepStatusSchema.default(WORKFLOW_STEP_STATUS.PENDING),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  executedBy: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type StepState = z.infer<typeof StepStateSchema>;

export const WorkflowInstanceSchema = z.object({
  id: z.string(),
  workflowDefinitionId: z.string(),
  caseId: z.string(),
  organizationId: z.string(),
  currentStepId: z.string().optional(),
  status: WorkflowInstanceStatusSchema.default(WORKFLOW_INSTANCE_STATUS.PENDING),
  stepStates: z.record(z.string(), StepStateSchema).default({}),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type WorkflowInstance = z.infer<typeof WorkflowInstanceSchema>;
