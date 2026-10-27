import { SupabaseClient } from '@supabase/supabase-js';
import { isDossierEntwurfsreif, normalizeDossier } from '@/lib/dossier';
import { createEmptyImmobilienFields, createEmptyImmobilienDossier } from '@/lib/dossier-defaults';
import {
  applyOrganizationFilter,
  executeMaybeSingle,
  executeList,
} from '@/lib/supabase/db-query-helpers';
import { DB_TABLES, Database, TableInsert } from '@/types/database';
import { DeletionReason, DeletionReceipt, DeletionReceiptSchema } from '@/types/deletion';
import { CaseStatus, DocumentRecord, DocumentListItem, CASE_STATUS } from '@/types/document';
import { Dossier, PersistenceMeta, STORAGE_TYPES } from '@/types/dossier';

export { createEmptyImmobilienFields, CASE_STATUS };
export type { CaseStatus, DocumentRecord, DocumentListItem };

export type PersistenceResult = PersistenceMeta & {
  persisted: boolean;
  storageType: typeof STORAGE_TYPES.SUPABASE;
  id: string;
};

/** SQLSTATE `no_data_found`: die Löschfunktion meldet damit auch fremde Kanzleien als „nicht gefunden“. */
const PG_NO_DATA_FOUND = 'P0002';
/** SQLSTATE `insufficient_privilege`: die Rolle darf nicht löschen. */
const PG_INSUFFICIENT_PRIVILEGE = '42501';
/** SQLSTATE `object_not_in_prerequisite_state`: für den Vorgang läuft noch eine Verarbeitung. */
const PG_OBJECT_NOT_IN_PREREQUISITE_STATE = '55006';

/** Höchstzahl der Vorgänge je Abruf der Dokumentliste (neueste zuerst). */
export const DOCUMENT_LIST_LIMIT = 200;

export class DossierNotFoundError extends Error {
  constructor(id: string) {
    super(`Vorgang nicht gefunden: ${id}`);
    this.name = 'DossierNotFoundError';
  }
}

export class DossierDeletionForbiddenError extends Error {
  constructor(id: string) {
    super(`Keine Berechtigung zum Löschen: ${id}`);
    this.name = 'DossierDeletionForbiddenError';
  }
}

export class DossierBusyError extends Error {
  constructor(id: string) {
    super(`Für den Vorgang läuft noch eine Verarbeitung: ${id}`);
    this.name = 'DossierBusyError';
  }
}

export interface UpdateResult {
  success: boolean;
  error?: string;
}

export interface IDossierRepository {
  findById(id: string, organizationId?: string): Promise<DocumentRecord | null>;
  save(dossier: Dossier, organizationId?: string): Promise<PersistenceResult>;
  update(id: string, dossier: Dossier, organizationId?: string): Promise<UpdateResult>;
  list(organizationId?: string): Promise<DocumentListItem[]>;
  delete(id: string, reason: DeletionReason): Promise<DeletionReceipt>;
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

    const { data, error } = await query.select('id');

    if (error) {
      throw new Error(`Supabase Dossier update fehlgeschlagen: ${error.message}`);
    }
    if (!data || data.length === 0) throw new DossierNotFoundError(id);

    return { success: true };
  }

  async list(organizationId?: string): Promise<DocumentListItem[]> {
    const query = applyOrganizationFilter(
      this.supabase
        .from(DB_TABLES.DOCUMENTS)
        .select('id, title, status, created_at, updated_at, caseType:content->>caseType'),
      organizationId
    );

    const data = await executeList(
      query.order('created_at', { ascending: false }).limit(DOCUMENT_LIST_LIMIT),
      'Dossier list'
    );

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

  async delete(id: string, reason: DeletionReason): Promise<DeletionReceipt> {
    // Rolle, Mandant und Vollständigkeit erzwingt die Datenbankfunktion in einer Transaktion.
    const { data, error } = await this.supabase.rpc('delete_dossier', {
      p_document_id: id,
      p_reason: reason,
    });
    if (error) {
      if (error.code === PG_NO_DATA_FOUND) throw new DossierNotFoundError(id);
      if (error.code === PG_INSUFFICIENT_PRIVILEGE) throw new DossierDeletionForbiddenError(id);
      if (error.code === PG_OBJECT_NOT_IN_PREREQUISITE_STATE) throw new DossierBusyError(id);
      throw new Error(`Supabase Dossier delete fehlgeschlagen: ${error.message}`);
    }
    return DeletionReceiptSchema.parse(data);
  }
}
