import { SupabaseClient } from '@supabase/supabase-js';
import { calculateNextStep } from '@/lib/workflow/engine';
import { AUDIT_ACTIONS } from '@/types/audit';
import { Database, DB_TABLES } from '@/types/database';
import { CaseType } from '@/types/dossier';
import {
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  WorkflowActor,
  WorkflowDefinition,
  WorkflowDefinitionSchema,
  WorkflowInstance,
  WorkflowInstanceSchema,
  WorkflowStepStatus,
} from '@/types/workflow';

export interface WorkflowAuditLogPayload {
  action: string;
  caseId: string;
  stepId: string;
  actor?: WorkflowActor | string;
  organizationId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface IWorkflowRepository {
  saveDefinition(definition: WorkflowDefinition, organizationId?: string): Promise<void>;
  getDefinition(id: string): Promise<WorkflowDefinition | null>;
  getDefinitionForCaseType(
    caseType: CaseType,
    organizationId?: string
  ): Promise<WorkflowDefinition | null>;
  createInstance(params: {
    workflowDefinitionId: string;
    caseId: string;
    organizationId: string;
  }): Promise<WorkflowInstance>;
  getInstance(id: string): Promise<WorkflowInstance | null>;
  getInstanceByCaseId(caseId: string): Promise<WorkflowInstance | null>;
  updateStepState(params: {
    instanceId: string;
    stepId: string;
    status: WorkflowStepStatus;
    executedBy?: WorkflowActor | string;
    metadata?: Record<string, unknown>;
    contextData?: Record<string, unknown>;
  }): Promise<WorkflowInstance>;
}

export interface WorkflowRepositoryOptions {
  onAuditLog?: (payload: WorkflowAuditLogPayload) => Promise<void>;
}

/**
 * Supabase Workflow Repository als Single Source of Truth (SSOT).
 * Strikte Persistenz mit Fail-Fast Runtime Exceptions bei DB-Fehlern gem. AGENTS.md.
 */
export class SupabaseWorkflowRepository implements IWorkflowRepository {
  private onAuditLog?: (payload: WorkflowAuditLogPayload) => Promise<void>;

  constructor(
    private supabase: SupabaseClient<Database>,
    options?: WorkflowRepositoryOptions
  ) {
    this.onAuditLog = options?.onAuditLog;
  }

  async saveDefinition(definition: WorkflowDefinition, organizationId?: string): Promise<void> {
    const { error } = await this.supabase.from(DB_TABLES.WORKFLOW_DEFINITIONS).upsert({
      id: definition.id,
      version: definition.version,
      case_type: definition.caseType,
      title: definition.title,
      organization_id: organizationId ?? null,
      steps: definition.steps,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Supabase saveDefinition error: ${error.message}`);
    }
  }

  async getDefinition(id: string): Promise<WorkflowDefinition | null> {
    const { data, error } = await this.supabase
      .from(DB_TABLES.WORKFLOW_DEFINITIONS)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase getDefinition error: ${error.message}`);
    }

    if (!data) return null;

    return WorkflowDefinitionSchema.parse({
      id: data.id,
      version: data.version,
      caseType: data.case_type,
      title: data.title,
      steps: data.steps,
      createdAt: data.created_at,
    });
  }

  async getDefinitionForCaseType(
    caseType: CaseType,
    organizationId?: string
  ): Promise<WorkflowDefinition | null> {
    let query = this.supabase
      .from(DB_TABLES.WORKFLOW_DEFINITIONS)
      .select('*')
      .eq('case_type', caseType);

    if (organizationId) {
      query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    } else {
      query = query.is('organization_id', null);
    }

    const { data, error } = await query
      .order('organization_id', { ascending: false, nullsFirst: false })
      .order('version', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Supabase getDefinitionForCaseType error: ${error.message}`);
    }

    const row = Array.isArray(data) && data[0] ? data[0] : null;
    if (!row) return null;

    return WorkflowDefinitionSchema.parse({
      id: row.id,
      version: row.version,
      caseType: row.case_type,
      title: row.title,
      steps: row.steps,
      createdAt: row.created_at,
    });
  }

  async createInstance(params: {
    workflowDefinitionId: string;
    caseId: string;
    organizationId: string;
  }): Promise<WorkflowInstance> {
    const definition = await this.getDefinition(params.workflowDefinitionId);
    if (!definition) {
      throw new Error(`Workflow definition ${params.workflowDefinitionId} not found`);
    }

    const firstStep = definition.steps[0];
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from(DB_TABLES.WORKFLOW_INSTANCES)
      .insert({
        workflow_definition_id: params.workflowDefinitionId,
        case_id: params.caseId,
        organization_id: params.organizationId,
        current_step_id: firstStep?.id ?? null,
        status: WORKFLOW_INSTANCE_STATUS.PENDING,
        step_states: {},
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase createInstance error: ${error?.message || 'Kein Datensatz zurückgegeben'}`
      );
    }

    return WorkflowInstanceSchema.parse({
      id: data.id,
      workflowDefinitionId: data.workflow_definition_id,
      caseId: data.case_id,
      organizationId: data.organization_id,
      currentStepId: data.current_step_id ?? undefined,
      status: data.status,
      stepStates: data.step_states,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  async getInstance(id: string): Promise<WorkflowInstance | null> {
    const { data, error } = await this.supabase
      .from(DB_TABLES.WORKFLOW_INSTANCES)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase getInstance error: ${error.message}`);
    }

    if (!data) return null;

    return WorkflowInstanceSchema.parse({
      id: data.id,
      workflowDefinitionId: data.workflow_definition_id,
      caseId: data.case_id,
      organizationId: data.organization_id,
      currentStepId: data.current_step_id ?? undefined,
      status: data.status,
      stepStates: data.step_states,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  async getInstanceByCaseId(caseId: string): Promise<WorkflowInstance | null> {
    const { data, error } = await this.supabase
      .from(DB_TABLES.WORKFLOW_INSTANCES)
      .select('*')
      .eq('case_id', caseId)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase getInstanceByCaseId error: ${error.message}`);
    }

    if (!data) return null;

    return WorkflowInstanceSchema.parse({
      id: data.id,
      workflowDefinitionId: data.workflow_definition_id,
      caseId: data.case_id,
      organizationId: data.organization_id,
      currentStepId: data.current_step_id ?? undefined,
      status: data.status,
      stepStates: data.step_states,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  async updateStepState(params: {
    instanceId: string;
    stepId: string;
    status: WorkflowStepStatus;
    executedBy?: WorkflowActor | string;
    metadata?: Record<string, unknown>;
    contextData?: Record<string, unknown>;
  }): Promise<WorkflowInstance> {
    const instance = await this.getInstance(params.instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${params.instanceId} not found`);
    }

    const definition = await this.getDefinition(instance.workflowDefinitionId);
    if (!definition) {
      throw new Error(`Workflow definition ${instance.workflowDefinitionId} not found`);
    }

    const now = new Date().toISOString();
    const existingStepState = instance.stepStates[params.stepId] || {
      status: WORKFLOW_STEP_STATUS.PENDING,
    };

    instance.stepStates[params.stepId] = {
      ...existingStepState,
      status: params.status,
      executedBy: params.executedBy || existingStepState.executedBy,
      completedAt:
        params.status === WORKFLOW_STEP_STATUS.COMPLETED ? now : existingStepState.completedAt,
      metadata: { ...existingStepState.metadata, ...params.metadata },
    };

    const nextStep = calculateNextStep(definition, instance, params.contextData || {});
    instance.currentStepId = nextStep?.id;
    instance.updatedAt = now;

    if (!nextStep) {
      instance.status = WORKFLOW_INSTANCE_STATUS.COMPLETED;
    } else {
      instance.status = WORKFLOW_INSTANCE_STATUS.IN_PROGRESS;
    }

    const { data: updated, error } = await this.supabase
      .from(DB_TABLES.WORKFLOW_INSTANCES)
      .update({
        current_step_id: instance.currentStepId ?? null,
        status: instance.status,
        step_states: instance.stepStates,
        updated_at: now,
      })
      .eq('id', instance.id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(
        `Supabase updateStepState error: ${error?.message || 'Update fehlgeschlagen'}`
      );
    }

    if (params.status === WORKFLOW_STEP_STATUS.COMPLETED && this.onAuditLog) {
      await this.onAuditLog({
        action: AUDIT_ACTIONS.WORKFLOW_STEP_COMPLETED,
        caseId: instance.caseId,
        stepId: params.stepId,
        actor: params.executedBy,
        organizationId: instance.organizationId,
        timestamp: now,
        metadata: params.metadata,
      });
    }

    return WorkflowInstanceSchema.parse({
      id: updated.id,
      workflowDefinitionId: updated.workflow_definition_id,
      caseId: updated.case_id,
      organizationId: updated.organization_id,
      currentStepId: updated.current_step_id ?? undefined,
      status: updated.status,
      stepStates: updated.step_states,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  }
}
