import { SupabaseClient } from '@supabase/supabase-js';
import { isDossierEntwurfsreif, normalizeDossier } from '@/lib/dossier';
import { createEmptyImmobilienFields } from '@/lib/dossier-defaults';
import { Dossier } from '@/types/dossier';

export { createEmptyImmobilienFields };

export const CASE_STATUS = {
  IN_PROGRESS: 'In Prüfung',
  DRAFT_READY: 'Entwurfsreif',
} as const;

export type CaseStatus = (typeof CASE_STATUS)[keyof typeof CASE_STATUS];

export interface DocumentRecord {
  id: string;
  title: string;
  status: CaseStatus;
  content: Dossier;
  created_at: string;
}

export interface PersistenceResult {
  persisted: boolean;
  storageType: 'supabase' | 'in-memory';
  caseNumber: string;
  id: string;
}

export interface UpdateResult {
  success: boolean;
  error?: string;
}

export interface IDossierRepository {
  findById(id: string): Promise<DocumentRecord | null>;
  save(dossier: Dossier): Promise<PersistenceResult>;
  update(id: string, dossier: Dossier): Promise<UpdateResult>;
  list(): Promise<DocumentRecord[]>;
  delete(id: string): Promise<boolean>;
}

export function getUniformCaseTitle(caseType: string | undefined, id: string): string {
  const shortId = id.slice(0, 8);
  const typeLabel = caseType
    ? caseType.charAt(0) + caseType.slice(1).toLowerCase().replace(/_/g, ' ')
    : 'Notarvorgang';
  return `${typeLabel} - ${shortId}`;
}

export function computeDocumentStatus(dossier: Dossier): CaseStatus {
  return isDossierEntwurfsreif(dossier) ? 'Entwurfsreif' : 'In Prüfung';
}

/**
 * Bounded In-Memory Repository mit FIFO-Verdrängung gegen Memory Leaks.
 */
export class InMemoryDossierRepository implements IDossierRepository {
  private documents: DocumentRecord[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 25) {
    this.maxCapacity = maxCapacity;
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const doc = this.documents.find((d) => d.id === id);
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

  async save(dossier: Dossier): Promise<PersistenceResult> {
    const normalized = normalizeDossier(dossier);
    const id = crypto.randomUUID();
    const title = getUniformCaseTitle(normalized.caseType, id);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);
    const createdAt = new Date().toISOString();

    const record: DocumentRecord = {
      id,
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
      storageType: 'in-memory',
      caseNumber: title,
      id,
    };
  }

  async update(id: string, dossier: Dossier): Promise<UpdateResult> {
    const normalized = normalizeDossier(dossier);
    const title = getUniformCaseTitle(normalized.caseType, id);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    const index = this.documents.findIndex((d) => d.id === id);
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

  async list(): Promise<DocumentRecord[]> {
    return this.documents.map((doc) => {
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

  async delete(id: string): Promise<boolean> {
    const index = this.documents.findIndex((d) => d.id === id);
    if (index !== -1) {
      this.documents.splice(index, 1);
      return true;
    }
    return false;
  }
}

/**
 * Supabase Repository mit Ausweichmöglichkeit auf das In-Memory Repository bei Ausfällen.
 */
export class SupabaseDossierRepository implements IDossierRepository {
  constructor(
    private supabase: SupabaseClient,
    private fallbackRepo: InMemoryDossierRepository
  ) {}

  async findById(id: string): Promise<DocumentRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return this.fallbackRepo.findById(id);
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
    } catch (err) {
      console.warn('Supabase findById fehlgeschlagen, wechsle zu Fallback:', err);
      return this.fallbackRepo.findById(id);
    }
  }

  async save(dossier: Dossier): Promise<PersistenceResult> {
    const normalized = normalizeDossier(dossier);
    const newId = crypto.randomUUID();
    const title = getUniformCaseTitle(normalized.caseType, newId);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    try {
      const { data, error } = await this.supabase
        .from('documents')
        .insert({
          id: newId,
          title,
          status,
          content: dossier,
        })
        .select('id, created_at')
        .single();

      if (error) {
        console.warn(
          'Supabase Insert fehlgeschlagen, speichere im In-Memory Fallback:',
          error.message
        );
        return this.fallbackRepo.save(dossier);
      }

      return {
        persisted: true,
        storageType: 'supabase',
        caseNumber: title,
        id: data?.id || newId,
      };
    } catch (err) {
      console.warn('Supabase Ausnahme, weiche auf In-Memory Fallback aus:', err);
      return this.fallbackRepo.save(dossier);
    }
  }

  async update(id: string, dossier: Dossier): Promise<UpdateResult> {
    const normalized = normalizeDossier(dossier);
    const title = getUniformCaseTitle(normalized.caseType, id);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    try {
      const { error } = await this.supabase
        .from('documents')
        .update({
          title,
          status,
          content: normalized,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.warn(
          'Supabase Update fehlgeschlagen, weiche auf In-Memory Fallback aus:',
          error.message
        );
        return this.fallbackRepo.update(id, dossier);
      }

      return { success: true };
    } catch (err) {
      console.warn('Supabase Update Ausnahme, aktualisiere In-Memory:', err);
      return this.fallbackRepo.update(id, dossier);
    }
  }

  async list(): Promise<DocumentRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return this.fallbackRepo.list();
      }

      const supabaseDocs = ((data || []) as DocumentRecord[]).map((doc) => {
        const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
        const normalizedContent = doc.content
          ? normalizeDossier({ ...doc.content, caseTitle: uniformTitle })
          : doc.content;
        const computedStatus = normalizedContent
          ? computeDocumentStatus(normalizedContent)
          : doc.status === 'Entwurfsreif'
            ? 'Entwurfsreif'
            : 'In Prüfung';
        return {
          ...doc,
          title: uniformTitle,
          content: normalizedContent,
          status: computedStatus,
        };
      });

      const existingIds = new Set(supabaseDocs.map((d) => d.id));
      const memoryDocs = (await this.fallbackRepo.list()).filter((d) => !existingIds.has(d.id));
      const merged = [...supabaseDocs, ...memoryDocs];

      return merged.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (err) {
      console.warn('Supabase list fehlgeschlagen, wechsle zu Fallback:', err);
      return this.fallbackRepo.list();
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.fallbackRepo.delete(id);
    try {
      const { error } = await this.supabase.from('documents').delete().eq('id', id);
      if (error) {
        console.warn('Supabase Delete Fehler:', error.message);
      }
      return true;
    } catch (err) {
      console.warn('Supabase Delete Ausnahme:', err);
      return true;
    }
  }
}
