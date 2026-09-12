import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '@/env';
import { Dossier } from '@/types/dossier';
import {
  IDossierRepository,
  InMemoryDossierRepository,
  SupabaseDossierRepository,
  DocumentRecord,
  CaseStatus,
  PersistenceResult,
  UpdateResult,
  getUniformCaseTitle,
  computeDocumentStatus,
  CASE_STATUS,
} from './repository';

export type { DocumentRecord, CaseStatus, PersistenceResult, UpdateResult, IDossierRepository };
export { getUniformCaseTitle, computeDocumentStatus, CASE_STATUS };

// Globaler Singleton für In-Memory-Speicher mit fester Obergrenze (max. 25 Einträge FIFO) gegen Memory Leaks
declare global {
  var __boundedInMemoryRepo: InMemoryDossierRepository | undefined;
}

if (!globalThis.__boundedInMemoryRepo) {
  globalThis.__boundedInMemoryRepo = new InMemoryDossierRepository(25);
}

const inMemoryRepo = globalThis.__boundedInMemoryRepo;

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
  return new SupabaseDossierRepository(supabase, inMemoryRepo);
}

// Abwärtskompatible Fassaden-Funktionen für bestehende Aufrufer
export async function persistDossierRecord(dossier: Dossier): Promise<PersistenceResult> {
  return getDossierRepository().save(dossier);
}

export async function updateDossierRecord(id: string, dossier: Dossier): Promise<UpdateResult> {
  return getDossierRepository().update(id, dossier);
}

export async function fetchDossierRecords(): Promise<DocumentRecord[]> {
  return getDossierRepository().list();
}

export async function fetchDossierRecordById(id: string): Promise<DocumentRecord | null> {
  return getDossierRepository().findById(id);
}

export async function deleteDossierRecord(id: string): Promise<boolean> {
  return getDossierRepository().delete(id);
}
