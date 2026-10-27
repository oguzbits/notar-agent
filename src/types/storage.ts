import { z } from 'zod';
import { DbUuidSchema, PG_UUID_REGEX } from './primitives';

export const STORAGE_BUCKET_NAMES = {
  DOSSIER_FILES: 'dossier-files',
} as const;

export type StorageBucketName = (typeof STORAGE_BUCKET_NAMES)[keyof typeof STORAGE_BUCKET_NAMES];

export const CreateUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1, 'Dateiname darf nicht leer sein'),
  fileType: z.string().min(1, 'Dateityp darf nicht leer sein'),
  fileSize: z.number().positive('Dateigröße muss positiv sein'),
  organizationId: DbUuidSchema.optional(),
});
export type CreateUploadUrlRequest = z.infer<typeof CreateUploadUrlRequestSchema>;

export const CreateUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().min(1, 'Upload-URL darf nicht leer sein'),
  storagePath: z.string().min(1, 'storagePath darf nicht leer sein'),
  token: z.string().optional(),
});
export type CreateUploadUrlResponse = z.infer<typeof CreateUploadUrlResponseSchema>;

/** Upload-Pfad genau `<Kanzlei-UUID>/<Datei>`: ein Schrägstrich, kein `..` (Client-Eingabe, daher streng). */
export const UploadStoragePathSchema = z
  .string()
  .max(512)
  .regex(new RegExp(`^${PG_UUID_REGEX.source.slice(1, -1)}/[^/]+$`), 'Ungültiger Speicherpfad')
  .refine((p) => !p.includes('..'), 'Ungültiger Speicherpfad');
