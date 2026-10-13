import { SupabaseClient } from '@supabase/supabase-js';
import { isDossierEntwurfsreif, normalizeDossier } from '@/lib/dossier';
import { createEmptyImmobilienFields, createEmptyImmobilienDossier } from '@/lib/dossier-defaults';
import {
  applyOrganizationFilter,
  executeMaybeSingle,
  executeList,
} from '@/lib/supabase/db-query-helpers';
import { DB_TABLES, Database, TableInsert } from '@/types/database';
import { CaseStatus, DocumentRecord, DocumentListItem, CASE_STATUS } from '@/types/document';
import { Dossier, PersistenceMeta, STORAGE_TYPES } from '@/types/dossier';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

export { createEmptyImmobilienFields, CASE_STATUS };
export type { CaseStatus, DocumentRecord, DocumentListItem };

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
  list(organizationId?: string): Promise<DocumentListItem[]>;
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
    const query = applyOrganizationFilter(
      this.supabase.from(DB_TABLES.DOCUMENTS).select('*').eq('id', id),
      organizationId
    );

    const data = await executeMaybeSingle(query.maybeSingle(), 'Dossier findById');
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

  async list(organizationId?: string): Promise<DocumentListItem[]> {
    const query = applyOrganizationFilter(
      this.supabase
        .from(DB_TABLES.DOCUMENTS)
        .select('id, title, status, created_at, updated_at, caseType:content->>caseType'),
      organizationId
    );

    const data = await executeList(query.order('created_at', { ascending: false }), 'Dossier list');

    return data.map((doc) => {
      const caseType = typeof doc.caseType === 'string' ? doc.caseType : undefined;
      const uniformTitle = getUniformCaseTitle(caseType, doc.id);
      return {
        id: doc.id,
        title: doc.title || uniformTitle,
        caseType,
        status: (doc.status as CaseStatus) || CASE_STATUS.IN_PROGRESS,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      };
    });
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const storagePathsToDelete: string[] = [];

    // 1. Suche nach verknüpften Jobs in dossier_jobs (die dieses Dossier erzeugt haben)
    try {
      let jobsQuery = this.supabase
        .from(DB_TABLES.DOSSIER_JOBS)
        .select('id, payload')
        .eq('result_dossier_id', id);

      if (organizationId) {
        jobsQuery = jobsQuery.eq('organization_id', organizationId);
      }

      const { data: linkedJobs } = await jobsQuery;
      if (linkedJobs && linkedJobs.length > 0) {
        for (const job of linkedJobs) {
          const payload = job.payload as { files?: Array<{ storagePath?: string }> } | null;
          const files = payload?.files ?? [];
          for (const file of files) {
            if (typeof file.storagePath === 'string' && file.storagePath.trim()) {
              storagePathsToDelete.push(file.storagePath.trim());
            }
          }
        }

        // Verknüpfte Jobs aus der Queue entfernen
        let delJobsQuery = this.supabase
          .from(DB_TABLES.DOSSIER_JOBS)
          .delete()
          .eq('result_dossier_id', id);

        if (organizationId) {
          delJobsQuery = delJobsQuery.eq('organization_id', organizationId);
        }

        await delJobsQuery;
      }
    } catch (jobErr) {
      console.warn('[delete] Warnung beim Bereinigen verknüpfter Jobs für Dossier:', id, jobErr);
    }

    // 2. Kaltarchiv-Dateien im Storage ermitteln (falls vorhanden)
    if (organizationId && this.supabase.storage) {
      try {
        const archiveFolder = `${organizationId}/archive/${id}`;
        const { data: archiveFiles } = await this.supabase.storage
          .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
          .list(archiveFolder);

        if (archiveFiles && archiveFiles.length > 0) {
          for (const af of archiveFiles) {
            storagePathsToDelete.push(`${archiveFolder}/${af.name}`);
          }
        }
      } catch (archiveListErr) {
        console.warn(
          '[delete] Warnung beim Ermitteln von Archiv-Dateien für Dossier:',
          id,
          archiveListErr
        );
      }
    }

    // 3. Physische Dateien aus dem Supabase Object Storage entfernen
    const uniquePaths = Array.from(new Set(storagePathsToDelete));
    if (uniquePaths.length > 0 && this.supabase.storage) {
      try {
        await this.supabase.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES).remove(uniquePaths);
      } catch (storageErr) {
        console.warn(
          '[delete] Warnung beim Entfernen von Storage-Dateien für Dossier:',
          id,
          storageErr
        );
      }
    }

    // 4. Dossier-Eintrag aus der Datenbank löschen
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
