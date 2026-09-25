import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateEnv } from '@/env';
import { IAuditRepository, SupabaseAuditRepository } from '@/lib/audit/audit-repository';
import { IJobRepository, SupabaseJobRepository } from '@/lib/jobs/job-repository';
import {
  IKnowledgeRepository,
  SupabaseKnowledgeRepository,
} from '@/lib/knowledge/supabase-knowledge-repository';
import { ITeamRepository, SupabaseTeamRepository } from '@/lib/team/team-repository';
import { IWorkflowRepository, SupabaseWorkflowRepository } from '@/lib/workflow/repository';
import { Database } from '@/types/database';
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

/**
 * Erstellt einen serverseitigen Supabase-Client.
 * Fail-Fast: Wirft eine RuntimeException, wenn Supabase-Credentials fehlen.
 */
export function getServerSupabase(): SupabaseClient<Database> {
  const env = validateEnv(process.env);
  const supabaseUrl = env.NEXT_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.NEXT_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase-Credentials fehlen: SUPABASE_URL und NEXT_SUPABASE_PUBLISHABLE_KEY müssen in .env.local gesetzt sein.'
    );
  }
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Factory zur Bereitstellung des konfigurierten Dossier-Repositories.
 */
export function getDossierRepository(client?: SupabaseClient<Database> | null): IDossierRepository {
  const supabase = client ?? getServerSupabase();
  return new SupabaseDossierRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Job-Repositories (Phase B.1 Queue).
 */
export function getJobRepository(client?: SupabaseClient<Database> | null): IJobRepository {
  const supabase = client ?? getServerSupabase();
  return new SupabaseJobRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Audit-Repositories (Phase C.1 Audit-Trail).
 */
export function getAuditRepository(client?: SupabaseClient<Database> | null): IAuditRepository {
  const supabase = client ?? getServerSupabase();
  return new SupabaseAuditRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Knowledge-Repositories (Phase C.3 RAG).
 */
export function getKnowledgeRepository(
  client?: SupabaseClient<Database> | null
): IKnowledgeRepository {
  const supabase = client ?? getServerSupabase();
  return new SupabaseKnowledgeRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Team-Repositories (Kanzleimitglieder & RBAC).
 */
export function getTeamRepository(client?: SupabaseClient<Database> | null): ITeamRepository {
  const supabase = client ?? getServerSupabase();
  return new SupabaseTeamRepository(supabase);
}

/**
 * Factory zur Bereitstellung des konfigurierten Workflow-Repositories.
 */
export function getWorkflowRepository(
  client?: SupabaseClient<Database> | null
): IWorkflowRepository {
  const supabase = client ?? getServerSupabase();
  return new SupabaseWorkflowRepository(supabase);
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
