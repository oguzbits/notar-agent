import { z } from 'zod';
import { DossierSchema } from './dossier';

export const ARCHIVE_STATUS = {
  ACTIVE: 'Aktiv',
  ARCHIVED: 'Archiviert',
} as const;

export const ArchiveStatusSchema = z.enum([ARCHIVE_STATUS.ACTIVE, ARCHIVE_STATUS.ARCHIVED]);
export type ArchiveStatus = (typeof ARCHIVE_STATUS)[keyof typeof ARCHIVE_STATUS];

export const ARCHIVE_STORAGE_PREFIX = 'archive' as const;

/**
 * Erzeugt einen deterministischen Dossier-Namespace zur Vermeidung von pgvector Cache-Pollution.
 * Format: `dossier:${dossierId}`
 */
export function buildDossierNamespace(dossierId: string): string {
  return `dossier:${dossierId}`;
}

/**
 * Schema für persistierte Wissens-Chunks innerhalb des Kaltarchivs.
 */
export const ArchivedKnowledgeChunkSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  legalBasis: z.string(),
});
export type ArchivedKnowledgeChunk = z.infer<typeof ArchivedKnowledgeChunkSchema>;

/**
 * Schema für Datei-Einträge im Archiv-Manifest.
 */
export const ArchivedFileEntrySchema = z.object({
  name: z.string(),
  storagePath: z.string().optional(),
  size: z.number().nonnegative().optional(),
});
export type ArchivedFileEntry = z.infer<typeof ArchivedFileEntrySchema>;

/**
 * Vollständiges, kryptografisch gesichertes Kaltarchiv-Snapshot-Schema gem. § 17 BeurkG.
 */
export const DossierArchiveSnapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  dossierId: z.string().min(1, 'Dossier-ID darf nicht leer sein'),
  organizationId: z.uuid('Ungültige Kanzlei-ID'),
  caseTitle: z.string().min(1, 'Falltitel darf nicht leer sein'),
  caseType: z.string().min(1, 'Falltyp darf nicht leer sein'),
  archivedAt: z.iso.datetime({ message: 'archivedAt muss ein gültiger ISO-Timestamp sein' }),
  archivedBy: z.string().min(1, 'Archivierender Notar / Sachbearbeiter erforderlich'),
  reason: z.string().min(3, 'Archivierungsgrund muss angegeben werden (§ 17 BeurkG)'),
  checksum: z.string().length(64, 'SHA-256 Prüfsumme muss genau 64 Hex-Zeichen lang sein'),
  dossierContent: DossierSchema,
  knowledgeChunks: z.array(ArchivedKnowledgeChunkSchema).default([]),
  fileManifest: z.array(ArchivedFileEntrySchema).default([]),
});
export type DossierArchiveSnapshot = z.infer<typeof DossierArchiveSnapshotSchema>;

/**
 * Ergebnis-Payload nach erfolgreichem Cold-Tier-Export und Vector-Purge.
 */
export const DossierArchiveResultSchema = z.object({
  dossierId: z.string(),
  organizationId: z.uuid(),
  archiveStoragePath: z.string(),
  archivedAt: z.iso.datetime(),
  checksum: z.string(),
  purgedVectorCount: z.number().int().nonnegative(),
  status: z.literal(ARCHIVE_STATUS.ARCHIVED),
});
export type DossierArchiveResult = z.infer<typeof DossierArchiveResultSchema>;

/**
 * Parameter für den Archivierungsaufruf.
 */
export const ArchiveDossierParamsSchema = z.object({
  dossierId: z.string().min(1),
  organizationId: z.uuid(),
  actor: z.string().min(1),
  reason: z.string().min(3),
});
export type ArchiveDossierParams = z.infer<typeof ArchiveDossierParamsSchema>;
