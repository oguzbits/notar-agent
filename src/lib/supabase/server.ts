import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '@/env';
import { IAuditRepository, SupabaseAuditRepository } from '@/lib/audit/audit-repository';
import {
  InMemoryAuditRepository,
  InMemoryDossierRepository,
  InMemoryJobRepository,
  InMemoryKnowledgeRepository,
  InMemoryTeamRepository,
} from '@/lib/in-memory';
import { IJobRepository, SupabaseJobRepository } from '@/lib/jobs/job-repository';
import {
  IKnowledgeRepository,
  SupabaseKnowledgeRepository,
} from '@/lib/knowledge/supabase-knowledge-repository';
import { ITeamRepository, SupabaseTeamRepository } from '@/lib/team/team-repository';
import { Dossier } from '@/types/dossier';
import {
  IDossierRepository,
  SupabaseDossierRepository,
  DocumentRecord,
  CaseStatus,
  PersistenceResult,
  UpdateResult,
  getUniformCaseTitle,
  computeDocumentStatus,
  CASE_STATUS,
} from './repository';

export type {
  DocumentRecord,
  CaseStatus,
  PersistenceResult,
  UpdateResult,
  IDossierRepository,
  IJobRepository,
  IAuditRepository,
  IKnowledgeRepository,
  ITeamRepository,
};
export { getUniformCaseTitle, computeDocumentStatus, CASE_STATUS };

// Globaler Singleton für In-Memory-Speicher mit fester Obergrenze gegen Memory Leaks
declare global {
  var __boundedInMemoryRepo: InMemoryDossierRepository | undefined;
  var __boundedInMemoryJobRepo: InMemoryJobRepository | undefined;
  var __boundedInMemoryAuditRepo: InMemoryAuditRepository | undefined;
  var __boundedInMemoryKnowledgeRepo: InMemoryKnowledgeRepository | undefined;
  var __boundedInMemoryTeamRepo: InMemoryTeamRepository | undefined;
}

if (!globalThis.__boundedInMemoryRepo) {
  globalThis.__boundedInMemoryRepo = new InMemoryDossierRepository(25);
}
if (!globalThis.__boundedInMemoryJobRepo) {
  globalThis.__boundedInMemoryJobRepo = new InMemoryJobRepository(50);
}
if (!globalThis.__boundedInMemoryAuditRepo) {
  globalThis.__boundedInMemoryAuditRepo = new InMemoryAuditRepository(100);
}
if (!globalThis.__boundedInMemoryKnowledgeRepo) {
  globalThis.__boundedInMemoryKnowledgeRepo = new InMemoryKnowledgeRepository();
}
if (!globalThis.__boundedInMemoryTeamRepo) {
  globalThis.__boundedInMemoryTeamRepo = new InMemoryTeamRepository();
}

const inMemoryRepo = globalThis.__boundedInMemoryRepo;
const inMemoryJobRepo = globalThis.__boundedInMemoryJobRepo;
const inMemoryAuditRepo = globalThis.__boundedInMemoryAuditRepo;
const inMemoryKnowledgeRepo = globalThis.__boundedInMemoryKnowledgeRepo;
const inMemoryTeamRepo = globalThis.__boundedInMemoryTeamRepo;

export function getServerSupabase() {
  const env = validateEnv(process.env);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Factory zur Bereitstellung des konfigurierten Dossier-Repositories.
 */
export function getDossierRepository(): IDossierRepository {
  const supabase = getServerSupabase();
  if (!supabase) {
    return inMemoryRepo;
  }
  return new SupabaseDossierRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Job-Repositories (Phase B.1 Queue).
 */
export function getJobRepository(): IJobRepository {
  const supabase = getServerSupabase();
  if (!supabase) {
    return inMemoryJobRepo;
  }
  return new SupabaseJobRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Audit-Repositories (Phase C.1 Audit-Trail).
 */
export function getAuditRepository(): IAuditRepository {
  const supabase = getServerSupabase();
  if (!supabase) {
    return inMemoryAuditRepo;
  }
  return new SupabaseAuditRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Knowledge-Repositories (Phase C.3 RAG).
 */
export function getKnowledgeRepository(): IKnowledgeRepository {
  const supabase = getServerSupabase();
  if (!supabase) {
    return inMemoryKnowledgeRepo;
  }
  return new SupabaseKnowledgeRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Team-Repositories (Kanzleimitglieder & RBAC).
 */
export function getTeamRepository(): ITeamRepository {
  const supabase = getServerSupabase();
  if (!supabase) {
    return inMemoryTeamRepo;
  }
  return new SupabaseTeamRepository(supabase);
}

// Abwärtskompatible Fassaden-Funktionen für bestehende Aufrufer mit optionaler Kanzleitrennung (§ 203 StGB)
export async function persistDossierRecord(
  dossier: Dossier,
  organizationId?: string
): Promise<PersistenceResult> {
  return getDossierRepository().save(dossier, organizationId);
}

export async function updateDossierRecord(
  id: string,
  dossier: Dossier,
  organizationId?: string
): Promise<UpdateResult> {
  return getDossierRepository().update(id, dossier, organizationId);
}

export async function fetchDossierRecords(organizationId?: string): Promise<DocumentRecord[]> {
  return getDossierRepository().list(organizationId);
}

export async function fetchDossierRecordById(
  id: string,
  organizationId?: string
): Promise<DocumentRecord | null> {
  return getDossierRepository().findById(id, organizationId);
}

export async function deleteDossierRecord(id: string, organizationId?: string): Promise<boolean> {
  return getDossierRepository().delete(id, organizationId);
}
