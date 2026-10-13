import { SupabaseClient } from '@supabase/supabase-js';
import stringify from 'fast-json-stable-stringify';
import { calculateFileFingerprint } from '@/lib/audit/audit-crypto';
import { SupabaseAuditRepository } from '@/lib/audit/audit-repository';
import {
  ARCHIVE_STATUS,
  ArchiveDossierParams,
  ArchiveDossierParamsSchema,
  buildDossierNamespace,
  DossierArchiveResult,
  DossierArchiveResultSchema,
  DossierArchiveSnapshot,
  DossierArchiveSnapshotSchema,
  ArchivedKnowledgeChunk,
  ArchivedFileEntry,
} from '@/types/archive';
import { AUDIT_ACTIONS } from '@/types/audit';
import { Database, DB_TABLES } from '@/types/database';
import { CASE_STATUS, CaseStatus } from '@/types/document';
import { DetectedDocument } from '@/types/dossier';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

export interface RestoreDossierParams {
  dossierId: string;
  organizationId: string;
  actor: string;
  reason: string;
  archiveStoragePath: string;
}

/**
 * Prüft, ob ein Vorgang für den Export in das Kaltarchiv zulässig ist.
 * Vorgänge müssen entwurfsreif bzw. beurkundet sein (§ 17 BeurkG).
 */
export function isDossierEligibleForArchival(status: CaseStatus): boolean {
  return status === CASE_STATUS.DRAFT_READY;
}

/**
 * Überführt einen beurkundungsreifen Vorgang in den verschlüsselten Supabase Object Storage (Cold Tier)
 * und löscht aktive Vektoren/Chunks aus PostgreSQL `knowledge_documents`.
 *
 * Architektur-Baseline: Legora & turbopuffer (Zero Cache-Pollution & Vermeidung von RAM-Thrashing).
 */
export async function archiveDossierToColdStorage(
  supabase: SupabaseClient<Database>,
  rawParams: ArchiveDossierParams
): Promise<DossierArchiveResult> {
  const params = ArchiveDossierParamsSchema.parse(rawParams);

  // 1. Vorgangsdaten aus PostgreSQL laden
  const { data: docData, error: docError } = await supabase
    .from(DB_TABLES.DOCUMENTS)
    .select('*')
    .eq('id', params.dossierId)
    .eq('organization_id', params.organizationId)
    .maybeSingle();

  if (docError || !docData) {
    throw new Error(
      `Archivierung fehlgeschlagen: Vorgang ${params.dossierId} nicht gefunden. ${docError?.message ?? ''}`.trim()
    );
  }

  // 2. Assoziierte Wissens-Chunks aus dem Vorgangs-Namespace abrufen
  const dossierNamespace = buildDossierNamespace(params.dossierId);
  const { data: knowledgeRows, error: kError } = await supabase
    .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
    .select('id, title, content, category, legal_basis')
    .eq('organization_id', params.organizationId)
    .eq('legal_basis', dossierNamespace);

  if (kError) {
    throw new Error(
      `Archivierung fehlgeschlagen: Wissens-Chunks konnten nicht abgefragt werden: ${kError.message}`
    );
  }

  const knowledgeChunks: ArchivedKnowledgeChunk[] = (knowledgeRows || []).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    legalBasis: row.legal_basis,
  }));

  // 3. Dateimanifest aus identifizierten Dokumenten zusammenstellen
  const detectedDocs = (docData.content?.detectedDocuments || []) as DetectedDocument[];
  const fileManifest: ArchivedFileEntry[] = detectedDocs.map((doc) => ({
    name: doc.fileName,
  }));

  // 4. Deterministische SHA-256 Prüfsumme über den Vorgang berechnen (§ 17 BeurkG)
  const canonicalJson = stringify(docData.content);
  const checksum = calculateFileFingerprint(canonicalJson);
  const timestamp = new Date().toISOString();

  // 5. Snapshot-Payload validieren
  const snapshot: DossierArchiveSnapshot = DossierArchiveSnapshotSchema.parse({
    snapshotVersion: 1,
    dossierId: params.dossierId,
    organizationId: params.organizationId,
    caseTitle: docData.title,
    caseType: docData.content?.caseType || 'Vorgang',
    archivedAt: timestamp,
    archivedBy: params.actor,
    reason: params.reason,
    checksum,
    dossierContent: docData.content,
    knowledgeChunks,
    fileManifest,
  });

  // 6. Snapshot in verschlüsselten Supabase Object Storage laden
  const archiveStoragePath = `${params.organizationId}/archive/${params.dossierId}/snapshot-${Date.now()}.json`;
  const snapshotBuffer = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf-8');

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
    .upload(archiveStoragePath, snapshotBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage Archiv-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  // 7. Aktive Vektoren aus pgvector / knowledge_documents bereinigen (Zero Cache-Pollution)
  const { error: purgeError } = await supabase
    .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
    .delete()
    .eq('organization_id', params.organizationId)
    .eq('legal_basis', dossierNamespace);

  if (purgeError) {
    throw new Error(`Bereinigung aktiver Wissensvektoren fehlgeschlagen: ${purgeError.message}`);
  }

  // 8. Vorgangsstatus in der Haupttabelle aktualisieren
  const { error: updateError } = await supabase
    .from(DB_TABLES.DOCUMENTS)
    .update({
      status: CASE_STATUS.DRAFT_READY,
      updated_at: timestamp,
    })
    .eq('id', params.dossierId)
    .eq('organization_id', params.organizationId);

  if (updateError) {
    throw new Error(`Aktualisierung des Vorgangsstatus fehlgeschlagen: ${updateError.message}`);
  }

  // 9. Revisionssicheren Audit-Log mit Hash-Chaining erfassen (§ 17 BeurkG)
  const auditRepo = new SupabaseAuditRepository(supabase);
  await auditRepo.appendEvent({
    documentId: params.dossierId,
    organizationId: params.organizationId,
    action: AUDIT_ACTIONS.DOSSIER_ARCHIVED,
    actor: params.actor,
    details: {
      note: params.reason,
      archive: {
        archiveStoragePath,
        checksum,
        vectorCount: knowledgeChunks.length,
      },
    },
  });

  return DossierArchiveResultSchema.parse({
    dossierId: params.dossierId,
    organizationId: params.organizationId,
    archiveStoragePath,
    archivedAt: timestamp,
    checksum,
    purgedVectorCount: knowledgeChunks.length,
    status: ARCHIVE_STATUS.ARCHIVED,
  });
}

/**
 * Stellt einen archivierten Vorgang aus dem Kaltarchiv (Supabase Object Storage) wieder her,
 * verifiziert die kryptografische Prüfsumme und re-indiziert bei Bedarf Wissensvektoren.
 */
export async function restoreDossierFromColdStorage(
  supabase: SupabaseClient<Database>,
  params: RestoreDossierParams
): Promise<DossierArchiveSnapshot> {
  // 1. Snapshot aus Object Storage herunterladen
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
    .download(params.archiveStoragePath);

  if (downloadError || !fileData) {
    throw new Error(
      `Download des Archiv-Snapshots fehlgeschlagen: ${downloadError?.message ?? 'Datei nicht gefunden'}`
    );
  }

  const rawText =
    typeof (fileData as { text?: () => Promise<string> }).text === 'function'
      ? await (fileData as { text: () => Promise<string> }).text()
      : Buffer.from(await fileData.arrayBuffer()).toString('utf-8');
  const parsedJson = JSON.parse(rawText);

  // 2. Snapshot-Struktur validieren
  const snapshot = DossierArchiveSnapshotSchema.parse(parsedJson);

  // 3. Kryptografische SHA-256 Integritätsprüfung
  const canonicalJson = stringify(snapshot.dossierContent);
  const calculatedChecksum = calculateFileFingerprint(canonicalJson);

  if (calculatedChecksum !== snapshot.checksum) {
    throw new Error(
      `Integritätsprüfung fehlgeschlagen: Berechnete Prüfsumme (${calculatedChecksum}) stimmt nicht mit Snapshot-Prüfsumme (${snapshot.checksum}) überein.`
    );
  }

  // 4. Wissens-Chunks bei Bedarf re-indizieren
  if (snapshot.knowledgeChunks && snapshot.knowledgeChunks.length > 0) {
    const insertPayload = snapshot.knowledgeChunks.map((chunk) => ({
      organization_id: params.organizationId,
      category: chunk.category,
      legal_basis: chunk.legalBasis,
      title: chunk.title,
      content: chunk.content,
      trigger_keywords: [],
    }));

    const { error: reindexError } = await supabase
      .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
      .insert(insertPayload);

    if (reindexError) {
      throw new Error(
        `Wiederherstellung der Wissens-Chunks fehlgeschlagen: ${reindexError.message}`
      );
    }
  }

  // 5. Revisionssicheren Audit-Log mit Hash-Chaining erfassen (§ 17 BeurkG)
  const auditRepo = new SupabaseAuditRepository(supabase);
  await auditRepo.appendEvent({
    documentId: params.dossierId,
    organizationId: params.organizationId,
    action: AUDIT_ACTIONS.DOSSIER_RESTORED,
    actor: params.actor,
    details: {
      note: params.reason,
      archive: {
        archiveStoragePath: params.archiveStoragePath,
        checksum: snapshot.checksum,
        vectorCount: snapshot.knowledgeChunks.length,
      },
    },
  });

  return snapshot;
}
