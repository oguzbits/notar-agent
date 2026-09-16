import { normalizeDossier } from '@/lib/dossier';
import {
  IDossierRepository,
  PersistenceResult,
  UpdateResult,
  getUniformCaseTitle,
  computeDocumentStatus,
} from '@/lib/supabase/repository';
import { DocumentRecord } from '@/types/document';
import { Dossier, STORAGE_TYPES } from '@/types/dossier';

/**
 * Bounded In-Memory Repository mit FIFO-Verdrängung und Kanzlei-Isolation (§ 203 StGB).
 * Ausschließlich für isolierte Unit-Tests und Zero-Config-Demos bestimmt.
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
    const newId = crypto.randomUUID();
    const title = getUniformCaseTitle(normalized.caseType, newId);
    normalized.caseTitle = title;
    const status = computeDocumentStatus(normalized);

    const record: DocumentRecord = {
      id: newId,
      organizationId,
      title,
      status,
      content: normalized,
      created_at: new Date().toISOString(),
    };

    this.documents.unshift(record);
    if (this.documents.length > this.maxCapacity) {
      this.documents.pop();
    }

    return {
      persisted: true,
      storageType: STORAGE_TYPES.IN_MEMORY,
      caseNumber: title,
      id: newId,
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

    if (index !== -1) {
      const existing = this.documents[index];
      if (existing) {
        this.documents[index] = {
          ...existing,
          title,
          status,
          content: normalized,
        };
      }
      return { success: true };
    }

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
