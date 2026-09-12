import { createClient } from '@supabase/supabase-js';
import { isDossierEntwurfsreif, normalizeDossier } from '@/lib/dossier-helpers';
import { Dossier } from '@/types/dossier';

export type CaseStatus = 'In Prüfung' | 'Entwurfsreif';

export interface DocumentRecord {
  id: string;
  title: string;
  status: CaseStatus;
  content: Dossier;
  created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Globaler In-Memory-Speicher für lokale Entwicklung / Fallback ohne konfigurierte Supabase-Keys (oder bei Verbindungsfehlern)
declare global {
  var __inMemoryDocuments: DocumentRecord[] | undefined;
}

if (!globalThis.__inMemoryDocuments) {
  globalThis.__inMemoryDocuments = [];
}

const memoryDocuments: DocumentRecord[] = globalThis.__inMemoryDocuments;

export function getServerSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
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

export async function persistDossierRecord(dossier: Dossier) {
  const normalizedDossier = normalizeDossier(dossier);
  const supabase = getServerSupabase();
  const newId = crypto.randomUUID();
  const title = getUniformCaseTitle(normalizedDossier.caseType, newId);
  normalizedDossier.caseTitle = title;
  const status: CaseStatus = computeDocumentStatus(normalizedDossier);
  const createdAt = new Date().toISOString();

  if (!supabase) {
    // In-Memory Fallback
    const memoryRecord: DocumentRecord = {
      id: newId,
      title,
      status,
      content: normalizedDossier,
      created_at: createdAt,
    };
    memoryDocuments.unshift(memoryRecord);

    return {
      persisted: true,
      storageType: 'in-memory' as const,
      caseNumber: title,
      id: newId,
    };
  }

  try {
    const { data, error } = await supabase
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
        'Hinweis: Konnte nicht in Supabase documents speichern, weiche auf In-Memory aus:',
        error.message
      );
      const memoryRecord: DocumentRecord = {
        id: newId,
        title,
        status,
        content: dossier,
        created_at: createdAt,
      };
      memoryDocuments.unshift(memoryRecord);
      return {
        persisted: true,
        storageType: 'in-memory' as const,
        caseNumber: title,
        id: newId,
      };
    }

    const assignedId = data?.id || newId;
    return {
      persisted: true,
      storageType: 'supabase' as const,
      caseNumber: title,
      id: assignedId,
    };
  } catch (err) {
    console.warn('Supabase Verbindung fehlgeschlagen, weiche auf In-Memory aus:', err);
    const memoryRecord: DocumentRecord = {
      id: newId,
      title,
      status,
      content: dossier,
      created_at: createdAt,
    };
    memoryDocuments.unshift(memoryRecord);
    return {
      persisted: true,
      storageType: 'in-memory' as const,
      caseNumber: title,
      id: newId,
    };
  }
}

export async function updateDossierRecord(id: string, dossier: Dossier) {
  const normalizedDossier = normalizeDossier(dossier);
  const supabase = getServerSupabase();
  const title = getUniformCaseTitle(normalizedDossier.caseType, id);
  normalizedDossier.caseTitle = title;
  const status: CaseStatus = computeDocumentStatus(normalizedDossier);

  if (!supabase) {
    // In-Memory Fallback
    const index = memoryDocuments.findIndex((doc) => doc.id === id);
    if (index !== -1) {
      memoryDocuments[index] = {
        ...memoryDocuments[index],
        title,
        status,
        content: normalizedDossier,
      };
      return { success: true };
    }
    // Falls noch nicht vorhanden, anlegen
    memoryDocuments.unshift({
      id,
      title,
      status,
      content: normalizedDossier,
      created_at: new Date().toISOString(),
    });
    return { success: true };
  }

  try {
    const { error } = await supabase
      .from('documents')
      .update({
        title,
        status,
        content: normalizedDossier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.warn('Fehler beim Aktualisieren in Supabase, aktualisiere In-Memory:', error.message);
      const index = memoryDocuments.findIndex((doc) => doc.id === id);
      if (index !== -1) {
        memoryDocuments[index] = {
          ...memoryDocuments[index],
          title: title || memoryDocuments[index].title,
          status,
          content: dossier,
        };
      }
      return { success: true };
    }

    return { success: true };
  } catch (err) {
    console.warn('Fehler beim Update in Supabase:', err);
    return { success: false, error: 'Update fehlgeschlagen' };
  }
}

export async function fetchDossierRecords(): Promise<DocumentRecord[]> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return [...memoryDocuments];
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Konnte Vorgänge nicht aus Supabase abrufen, nutze In-Memory:', error.message);
      return [...memoryDocuments];
    }

    // Wenn Supabase Daten liefert, aber auch InMemory existiert, können wir sie zusammenführen
    const supabaseDocs = ((data || []) as DocumentRecord[]).map((doc) => {
      const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
      const normalizedContent = doc.content
        ? normalizeDossier({ ...doc.content, caseTitle: uniformTitle })
        : doc.content;
      const computedStatus: CaseStatus = normalizedContent
        ? computeDocumentStatus(normalizedContent)
        : (doc.status as string) === 'Beurkundet' || (doc.status as string) === 'Entwurfsreif'
          ? 'Entwurfsreif'
          : 'In Prüfung';
      return {
        ...doc,
        title: uniformTitle,
        content: normalizedContent,
        status: computedStatus,
      };
    });

    // Falls in InMemory zusätzliche Vorgänge liegen
    const existingIds = new Set(supabaseDocs.map((d) => d.id));
    const memoryNormalized = memoryDocuments
      .filter((d) => !existingIds.has(d.id))
      .map((doc) => {
        const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
        return {
          ...doc,
          title: uniformTitle,
          content: doc.content
            ? normalizeDossier({
                ...doc.content,
                caseTitle: uniformTitle,
              })
            : doc.content,
        };
      });
    const merged = [...supabaseDocs, ...memoryNormalized];

    return merged.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (err) {
    console.warn('Fehler beim Abrufen aus Supabase, weiche auf In-Memory aus:', err);
    return memoryDocuments.map((doc) => {
      const uniformTitle = getUniformCaseTitle(doc.content?.caseType, doc.id);
      return {
        ...doc,
        title: uniformTitle,
        content: doc.content
          ? normalizeDossier({
              ...doc.content,
              caseTitle: uniformTitle,
            })
          : doc.content,
      };
    });
  }
}

export async function fetchDossierRecordById(id: string): Promise<DocumentRecord | null> {
  const supabase = getServerSupabase();
  if (!supabase) {
    const doc = memoryDocuments.find((doc) => doc.id === id);
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

  try {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

    if (error) {
      console.warn('Konnte Vorgang nicht aus Supabase abrufen, prüfe In-Memory:', error.message);
      const doc = memoryDocuments.find((doc) => doc.id === id);
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
    console.warn('Fehler beim Abrufen aus Supabase, weiche auf In-Memory aus:', err);
    const doc = memoryDocuments.find((doc) => doc.id === id);
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
}

export async function deleteDossierRecord(id: string): Promise<boolean> {
  const supabase = getServerSupabase();

  // Immer auch aus In-Memory entfernen
  const memoryIndex = memoryDocuments.findIndex((doc) => doc.id === id);
  if (memoryIndex !== -1) {
    memoryDocuments.splice(memoryIndex, 1);
  }

  if (!supabase) {
    return true;
  }

  try {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      console.warn('Löschen in Supabase fehlgeschlagen:', error.message);
    }
    return true;
  } catch (err) {
    console.error('Fehler beim Löschen des Vorgangs in Supabase:', err);
    return memoryIndex !== -1;
  }
}
