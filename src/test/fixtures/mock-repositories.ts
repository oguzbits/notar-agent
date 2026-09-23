import { vi } from 'vitest';
import { calculateAuditRecordHash, GENESIS_HASH, verifyAuditChain } from '@/lib/audit/audit-crypto';
import type { IAuditRepository, AppendAuditParams } from '@/lib/audit/audit-repository';
import type { IJobRepository } from '@/lib/jobs/job-repository';
import type {
  IDossierRepository,
  DocumentRecord,
  PersistenceResult,
  UpdateResult,
} from '@/lib/supabase/repository';
import type { ITeamRepository } from '@/lib/team/team-repository';
import { calculateNextStep } from '@/lib/workflow/engine';
import { AUDIT_ACTIONS, type AuditLogEntry } from '@/types/audit';
import type { TeamMember, InviteMemberRequest } from '@/types/auth';
import { CASE_STATUS } from '@/types/document';
import type { Dossier } from '@/types/dossier';
import { STORAGE_TYPES } from '@/types/dossier';
import { JOB_STATUS, type DossierJob, type CreateJobPayload } from '@/types/jobs';
import type { NotaryRole } from '@/types/organization';
import {
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  type WorkflowActor,
  type WorkflowDefinition,
  type WorkflowInstance,
  type WorkflowStepStatus,
} from '@/types/workflow';

/**
 * Creates an in-memory mock implementation of IJobRepository using vi.fn()
 */
export function createMockJobRepository(): IJobRepository {
  const jobs = new Map<string, DossierJob>();
  let idCounter = 0;

  return {
    createJob: vi.fn(async (payload: CreateJobPayload, organizationId?: string) => {
      const id = `job-${++idCounter}`;
      const job: DossierJob = {
        id,
        status: JOB_STATUS.PENDING,
        payload,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organizationId,
      };
      jobs.set(id, job);
      return job;
    }),
    getJobById: vi.fn(async (id: string) => jobs.get(id) ?? null),
    claimNextPendingJob: vi.fn(async () => {
      for (const job of jobs.values()) {
        if (job.status === JOB_STATUS.PENDING) {
          job.status = JOB_STATUS.PROCESSING;
          job.lockedAt = new Date().toISOString();
          return job;
        }
      }
      return null;
    }),
    updateJobStatus: vi.fn(async (id: string, update: Partial<DossierJob>) => {
      const job = jobs.get(id);
      if (!job) return null;
      Object.assign(job, update, { updatedAt: new Date().toISOString() });
      return job;
    }),
    listJobs: vi.fn(async (organizationId?: string) => {
      const all = [...jobs.values()];
      if (organizationId) {
        return all.filter((j) => j.organizationId === organizationId);
      }
      return all;
    }),
    recoverOrphanJobs: vi.fn(async () => []),
    pruneCompletedJobs: vi.fn(async () => 0),
  };
}

/**
 * Creates an in-memory mock implementation of ITeamRepository using vi.fn()
 */
export function createMockTeamRepository(): ITeamRepository {
  const members = new Map<string, TeamMember>();
  let idCounter = 0;

  return {
    listMembers: vi.fn(async (organizationId: string) => {
      return [...members.values()].filter((m) => m.organizationId === organizationId);
    }),
    getMemberById: vi.fn(async (id: string, organizationId: string) => {
      const member = members.get(id);
      if (member && member.organizationId === organizationId) {
        return member;
      }
      return null;
    }),
    updateMemberRole: vi.fn(async (id: string, newRole: NotaryRole, organizationId: string) => {
      const member = members.get(id);
      if (!member || member.organizationId !== organizationId) return null;
      member.role = newRole;
      return member;
    }),
    inviteMember: vi.fn(async (data: InviteMemberRequest, organizationId: string) => {
      const id = `member-${++idCounter}`;
      const member: TeamMember = {
        id,
        organizationId,
        name: data.name,
        email: data.email,
        role: data.role,
        title: data.title ?? undefined,
        joinedAt: new Date().toISOString(),
      };
      members.set(id, member);
      return member;
    }),
    removeMember: vi.fn(async (id: string, organizationId: string) => {
      const member = members.get(id);
      if (member && member.organizationId === organizationId) {
        members.delete(id);
        return true;
      }
      return false;
    }),
  };
}

/**
 * Creates an in-memory mock implementation of IDossierRepository using vi.fn()
 */
export function createMockDossierRepository(): IDossierRepository {
  const docs = new Map<string, DocumentRecord>();
  let idCounter = 0;

  return {
    save: vi.fn(async (dossier: Dossier, organizationId?: string): Promise<PersistenceResult> => {
      const id = `doc-${++idCounter}`;
      const record: DocumentRecord = {
        id,
        title: dossier.caseTitle,
        status: CASE_STATUS.DRAFT_READY,
        created_at: new Date().toISOString(),
        organizationId,
        content: dossier,
      };
      docs.set(id, record);
      return {
        id,
        storageType: STORAGE_TYPES.SUPABASE,
        persisted: true,
        caseNumber: dossier.caseTitle,
      };
    }),
    findById: vi.fn(async (id: string, organizationId?: string): Promise<DocumentRecord | null> => {
      const doc = docs.get(id);
      if (!doc) return null;
      if (organizationId && doc.organizationId !== organizationId) return null;
      return doc;
    }),
    list: vi.fn(async (organizationId?: string): Promise<DocumentRecord[]> => {
      const all = [...docs.values()];
      if (organizationId) {
        return all.filter((d) => d.organizationId === organizationId);
      }
      return all;
    }),
    update: vi.fn(
      async (id: string, dossier: Dossier, organizationId?: string): Promise<UpdateResult> => {
        const existing = docs.get(id);
        if (existing) {
          if (organizationId && existing.organizationId !== organizationId) {
            return { success: false, error: 'Not found' };
          }
          existing.content = dossier;
          existing.title = dossier.caseTitle;
          return { success: true };
        }
        // Auto-create for testing convenience
        const newRecord: DocumentRecord = {
          id,
          title: dossier.caseTitle,
          status: CASE_STATUS.DRAFT_READY,
          created_at: new Date().toISOString(),
          organizationId,
          content: dossier,
        };
        docs.set(id, newRecord);
        return { success: true };
      }
    ),
    delete: vi.fn(async (id: string, organizationId?: string): Promise<boolean> => {
      const doc = docs.get(id);
      if (!doc) return false;
      if (organizationId && doc.organizationId !== organizationId) return false;
      docs.delete(id);
      return true;
    }),
  };
}

/**
 * Creates an in-memory mock implementation of IAuditRepository using vi.fn()
 */
export function createMockAuditRepository(): IAuditRepository {
  const store = new Map<string, AuditLogEntry[]>();

  return {
    appendEvent: vi.fn(async (params: AppendAuditParams): Promise<AuditLogEntry> => {
      const history = store.get(params.documentId) || [];
      const sequenceNumber = history.length;
      const lastEntry = sequenceNumber > 0 ? history[sequenceNumber - 1] : undefined;
      const previousHash = lastEntry ? lastEntry.currentHash : GENESIS_HASH;
      const timestamp = params.timestamp || new Date().toISOString();
      const details = params.details || {};

      const currentHash = calculateAuditRecordHash({
        documentId: params.documentId,
        sequenceNumber,
        action: params.action,
        timestamp,
        actor: params.actor,
        previousHash,
        details,
      });

      const entry: AuditLogEntry = {
        id: `audit-${params.documentId}-${sequenceNumber}`,
        documentId: params.documentId,
        organizationId: params.organizationId,
        sequenceNumber,
        action: params.action,
        actor: params.actor,
        timestamp,
        previousHash,
        currentHash,
        details,
      };

      history.push(entry);
      store.set(params.documentId, history);
      return entry;
    }),
    getHistory: vi.fn(
      async (documentId: string, organizationId?: string): Promise<AuditLogEntry[]> => {
        const history = store.get(documentId) || [];
        if (organizationId) {
          return history.filter((e) => e.organizationId === organizationId);
        }
        return [...history];
      }
    ),
    verifyIntegrity: vi.fn(async (documentId: string, organizationId?: string) => {
      const history = store.get(documentId) || [];
      const filtered = organizationId
        ? history.filter((e) => e.organizationId === organizationId)
        : history;
      return verifyAuditChain(filtered);
    }),
  };
}

/**
 * Creates an isolated mock implementation of IWorkflowRepository for unit tests
 */
export function createMockWorkflowRepository(options?: {
  onAuditLog?: (payload: {
    action: string;
    caseId: string;
    stepId: string;
    actor?: string;
    organizationId: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const definitions = new Map<string, WorkflowDefinition>();
  const instances = new Map<string, WorkflowInstance>();

  return {
    saveDefinition: vi.fn(async (definition: WorkflowDefinition) => {
      definitions.set(definition.id, definition);
    }),
    getDefinition: vi.fn(async (id: string) => definitions.get(id) ?? null),
    getDefinitionForCaseType: vi.fn(async (caseType: string) => {
      for (const def of definitions.values()) {
        if (def.caseType === caseType) return def;
      }
      return null;
    }),
    createInstance: vi.fn(
      async (params: { workflowDefinitionId: string; caseId: string; organizationId: string }) => {
        const def = definitions.get(params.workflowDefinitionId);
        const firstStep = def?.steps[0];
        const now = new Date().toISOString();
        const inst: WorkflowInstance = {
          id: `wfi-mock-${instances.size + 1}`,
          workflowDefinitionId: params.workflowDefinitionId,
          caseId: params.caseId,
          organizationId: params.organizationId,
          currentStepId: firstStep?.id,
          status: WORKFLOW_INSTANCE_STATUS.PENDING,
          stepStates: {},
          createdAt: now,
          updatedAt: now,
        };
        instances.set(inst.id, inst);
        return inst;
      }
    ),
    getInstance: vi.fn(async (id: string) => instances.get(id) ?? null),
    getInstanceByCaseId: vi.fn(async (caseId: string) => {
      for (const inst of instances.values()) {
        if (inst.caseId === caseId) return inst;
      }
      return null;
    }),
    updateStepState: vi.fn(
      async (params: {
        instanceId: string;
        stepId: string;
        status: WorkflowStepStatus;
        executedBy?: WorkflowActor | string;
        metadata?: Record<string, unknown>;
        contextData?: Record<string, unknown>;
      }) => {
        const inst = instances.get(params.instanceId);
        if (!inst) throw new Error('Not found');
        const def = definitions.get(inst.workflowDefinitionId);
        if (!def) throw new Error('Def not found');

        const now = new Date().toISOString();
        inst.stepStates[params.stepId] = {
          status: params.status,
          executedBy: params.executedBy,
          completedAt: params.status === WORKFLOW_STEP_STATUS.COMPLETED ? now : undefined,
          metadata: params.metadata,
        };

        const next = calculateNextStep(def, inst, params.contextData || {});
        inst.currentStepId = next?.id;
        inst.status = next
          ? WORKFLOW_INSTANCE_STATUS.IN_PROGRESS
          : WORKFLOW_INSTANCE_STATUS.COMPLETED;
        inst.updatedAt = now;

        if (params.status === WORKFLOW_STEP_STATUS.COMPLETED && options?.onAuditLog) {
          await options.onAuditLog({
            action: AUDIT_ACTIONS.WORKFLOW_STEP_COMPLETED,
            caseId: inst.caseId,
            stepId: params.stepId,
            actor: params.executedBy,
            organizationId: inst.organizationId,
            timestamp: now,
            metadata: params.metadata,
          });
        }

        return inst;
      }
    ),
  };
}
