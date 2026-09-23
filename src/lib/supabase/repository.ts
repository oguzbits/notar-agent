import { SupabaseClient } from '@supabase/supabase-js';
import { isDossierEntwurfsreif, normalizeDossier } from '@/lib/dossier';
import { createEmptyImmobilienFields, createEmptyImmobilienDossier } from '@/lib/dossier-defaults';
import { DB_TABLES, Database, TableInsert } from '@/types/database';
import { CaseStatus, DocumentRecord, CASE_STATUS } from '@/types/document';
import { Dossier, PersistenceMeta, STORAGE_TYPES } from '@/types/dossier';

export { createEmptyImmobilienFields, CASE_STATUS };
export type { CaseStatus, DocumentRecord };

export type PersistenceResult = PersistenceMeta & {
  persisted: boolean;
  storageType: typeof STORAGE_TYPES.SUPABASE;
  id: string;
};

export interface UpdateResult {
  success: boolean;
  error?: string;
}

export interface IDossierRepository {
  findById(id: string, organizationId?: string): Promise<DocumentRecord | null>;
  save(dossier: Dossier, organizationId?: string): Promise<PersistenceResult>;
  update(id: string, dossier: Dossier, organizationId?: string): Promise<UpdateResult>;
  list(organizationId?: string): Promise<DocumentRecord[]>;
  delete(id: string, organizationId?: string): Promise<boolean>;
}

export function getUniformCaseTitle(caseType?: string, docId?: string): string {
  const typeLabel = caseType || 'Vorgang';
  const shortId = docId ? docId.slice(0, 8) : 'Entwurf';
  return `${typeLabel} - ${shortId}`;
}

export function computeDocumentStatus(dossier: Dossier): CaseStatus {
  return isDossierEntwurfsreif(dossier) ? CASE_STATUS.DRAFT_READY : CASE_STATUS.IN_PROGRESS;
}

/**
 * Supabase Repository als Single Source of Truth (SSOT).
 * Strikte Fehlerbehandlung (Fail-Fast).
 */
export class SupabaseDossierRepository implements IDossierRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string, organizationId?: string): Promise<DocumentRecord | null> {
    let query = this.supabase.from(DB_TABLES.DOCUMENTS).select('*').eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Supabase Dossier findById fehlgeschlagen: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const rawContent = data.content;
    const uniformTitle = getUniformCaseTitle(rawContent?.caseType, data.id);
    const normalizedContent = rawContent
      ? normalizeDossier({ ...rawContent, caseTitle: uniformTitle })
      : createEmptyImmobilienDossier(uniformTitle);

    return {
      id: data.id,
      title: uniformTitle,
      status: (data.status as CaseStatus) || CASE_STATUS.IN_PROGRESS,
      content: normalizedContent,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async save(dossier: Dossier, organizationId?: string): Promise<PersistenceResult> {
    const newId = crypto.randomUUID();
    const normalized = normalizeDossier(dossier);
    const title = getUniformCaseTitle(normalized.caseType, newId);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    const insertPayload: TableInsert<typeof DB_TABLES.DOCUMENTS> = {
      id: newId,
      title,
      status,
      content: normalized,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(organizationId ? { organization_id: organizationId } : {}),
    };

    const { data, error } = await this.supabase
      .from(DB_TABLES.DOCUMENTS)
      .insert(insertPayload)
      .select('id, created_at')
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase Dossier save fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return {
      persisted: true,
      storageType: STORAGE_TYPES.SUPABASE,
      caseNumber: title,
      id: data.id || newId,
    };
  }

  async update(id: string, dossier: Dossier, organizationId?: string): Promise<UpdateResult> {
    const normalized = normalizeDossier(dossier);
    const title = getUniformCaseTitle(normalized.caseType, id);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    let query = this.supabase
      .from(DB_TABLES.DOCUMENTS)
      .update({
        title,
        status,
        content: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Supabase Dossier update fehlgeschlagen: ${error.message}`);
    }

    return { success: true };
  }

  async list(organizationId?: string): Promise<DocumentRecord[]> {
    let query = this.supabase.from(DB_TABLES.DOCUMENTS).select('*');

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) {
      throw new Error(
        `Supabase Dossier list fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return data.map((doc) => {
      const rawContent = doc.content;
      const uniformTitle = getUniformCaseTitle(rawContent?.caseType, doc.id);
      const normalizedContent = rawContent
        ? normalizeDossier({ ...rawContent, caseTitle: uniformTitle })
        : createEmptyImmobilienDossier(uniformTitle);
      const computedStatus = computeDocumentStatus(normalizedContent);
      return {
        id: doc.id,
        title: uniformTitle,
        content: normalizedContent,
        status: computedStatus,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      };
    });
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    let query = this.supabase.from(DB_TABLES.DOCUMENTS).delete().eq('id', id);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { error } = await query;
    if (error) {
      throw new Error(`Supabase Dossier delete fehlgeschlagen: ${error.message}`);
    }
    return true;
  }
}
