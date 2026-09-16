import { SupabaseClient } from '@supabase/supabase-js';
import { isDossierEntwurfsreif, normalizeDossier } from '@/lib/dossier';
import { createEmptyImmobilienFields } from '@/lib/dossier-defaults';
import { CaseStatus, DocumentRecord, CASE_STATUS } from '@/types/document';
import { Dossier, PersistenceMeta, STORAGE_TYPES } from '@/types/dossier';

export { createEmptyImmobilienFields, CASE_STATUS };
export type { CaseStatus, DocumentRecord };

export type PersistenceResult = PersistenceMeta & {
  persisted: boolean;
  storageType: typeof STORAGE_TYPES.SUPABASE | typeof STORAGE_TYPES.IN_MEMORY;
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

export function getUniformCaseTitle(caseType: string | undefined, id: string): string {
  const shortId = id.slice(0, 8);
  const typeLabel = caseType
    ? caseType.charAt(0) + caseType.slice(1).toLowerCase().replace(/_/g, ' ')
    : 'Notarvorgang';
  return `${typeLabel} - ${shortId}`;
}

export function computeDocumentStatus(dossier: Dossier): CaseStatus {
  return isDossierEntwurfsreif(dossier) ? CASE_STATUS.DRAFT_READY : CASE_STATUS.IN_PROGRESS;
}

/**
 * Bounded In-Memory Repository mit FIFO-Verdrängung und Kanzlei-Isolation (§ 203 StGB).
 */
export class InMemoryDossierRepository implements IDossierRepository {
  private documents: DocumentRecord[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 25) {
    this.maxCapacity = maxCapacity;
  }

  async findById(id: string, organizationId?: string): Promise<DocumentRecord | null> {
    const doc = this.documents.find((d) => {
      if (d.id !== id) return false;
      if (organizationId && d.organizationId && d.organizationId !== organizationId) return false;
      return true;
    });
    if (!doc) return null;
    const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
    return {
      ...doc,
      title: uniformTitle,
      content: doc.content
        ? normalizeDossier({ ...doc.content, caseTitle: uniformTitle })
        : doc.content,
    };
  }

  async save(dossier: Dossier, organizationId?: string): Promise<PersistenceResult> {
    const normalized = normalizeDossier(dossier);
    const id = crypto.randomUUID();
    const title = getUniformCaseTitle(normalized.caseType, id);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);
    const createdAt = new Date().toISOString();

    const record: DocumentRecord = {
      id,
      organizationId,
      title,
      status,
      content: normalized,
      created_at: createdAt,
    };

    this.documents.unshift(record);
    if (this.documents.length > this.maxCapacity) {
      this.documents.pop(); // FIFO: Ältestes Element entfernen
    }

    return {
      persisted: true,
      storageType: STORAGE_TYPES.IN_MEMORY,
      caseNumber: title,
      id,
    };
  }

  async update(id: string, dossier: Dossier, organizationId?: string): Promise<UpdateResult> {
    const normalized = normalizeDossier(dossier);
    const title = getUniformCaseTitle(normalized.caseType, id);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    const index = this.documents.findIndex((d) => {
      if (d.id !== id) return false;
      if (organizationId && d.organizationId && d.organizationId !== organizationId) return false;
      return true;
    });

    const existing = this.documents[index];
    if (index !== -1 && existing) {
      this.documents[index] = {
        ...existing,
        title,
        status,
        content: normalized,
      };
      return { success: true };
    }

    // Wenn nicht vorhanden, anlegen
    const newRecord: DocumentRecord = {
      id,
      organizationId,
      title,
      status,
      content: normalized,
      created_at: new Date().toISOString(),
    };
    this.documents.unshift(newRecord);
    if (this.documents.length > this.maxCapacity) {
      this.documents.pop();
    }
    return { success: true };
  }

  async list(organizationId?: string): Promise<DocumentRecord[]> {
    const filtered = organizationId
      ? this.documents.filter((doc) => !doc.organizationId || doc.organizationId === organizationId)
      : this.documents;

    return filtered.map((doc) => {
      const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
      return {
        ...doc,
        title: uniformTitle,
        content: doc.content
          ? normalizeDossier({ ...doc.content, caseTitle: uniformTitle })
          : doc.content,
      };
    });
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const index = this.documents.findIndex((d) => {
      if (d.id !== id) return false;
      if (organizationId && d.organizationId && d.organizationId !== organizationId) return false;
      return true;
    });
    if (index !== -1) {
      this.documents.splice(index, 1);
      return true;
    }
    return false;
  }
}

/**
/**
 * Supabase Repository als Single Source of Truth (SSOT).
 * Strikte Fehlerbehandlung ohne stillen In-Memory Fallback.
 */
export class SupabaseDossierRepository implements IDossierRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string, organizationId?: string): Promise<DocumentRecord | null> {
    let query = this.supabase.from('documents').select('*').eq('id', id);

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

    const doc = data as DocumentRecord;
    const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
    return {
      ...doc,
      title: uniformTitle,
      content: doc.content
        ? normalizeDossier({ ...doc.content, caseTitle: uniformTitle })
        : doc.content,
    };
  }

  async save(dossier: Dossier, organizationId?: string): Promise<PersistenceResult> {
    const normalized = normalizeDossier(dossier);
    const newId = crypto.randomUUID();
    const title = getUniformCaseTitle(normalized.caseType, newId);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    const insertPayload: Record<string, unknown> = {
      id: newId,
      title,
      status,
      content: dossier,
    };
    if (organizationId) {
      insertPayload.organization_id = organizationId;
    }

    const { data, error } = await this.supabase
      .from('documents')
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
      .from('documents')
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
    let query = this.supabase.from('documents').select('*');

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) {
      throw new Error(
        `Supabase Dossier list fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return (data as DocumentRecord[]).map((doc) => {
      const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
      const normalizedContent = doc.content
        ? normalizeDossier({ ...doc.content, caseTitle: uniformTitle })
        : doc.content;
      const computedStatus = normalizedContent
        ? computeDocumentStatus(normalizedContent)
        : doc.status === CASE_STATUS.DRAFT_READY
          ? CASE_STATUS.DRAFT_READY
          : CASE_STATUS.IN_PROGRESS;
      return {
        ...doc,
        title: uniformTitle,
        content: normalizedContent,
        status: computedStatus,
      };
    });
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    let query = this.supabase.from('documents').delete().eq('id', id);
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
