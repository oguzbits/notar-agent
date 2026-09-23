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
import type { AuditLogEntry } from '@/types/audit';
import type { TeamMember, InviteMemberRequest } from '@/types/auth';
import { CASE_STATUS } from '@/types/document';
import type { Dossier } from '@/types/dossier';
import { STORAGE_TYPES } from '@/types/dossier';
import { JOB_STATUS, type DossierJob, type CreateJobPayload } from '@/types/jobs';
import type { NotaryRole } from '@/types/organization';

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
