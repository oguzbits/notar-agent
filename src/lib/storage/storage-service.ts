import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { STORAGE_BUCKET_NAMES, CreateUploadUrlResponse } from '@/types/storage';

export interface CreateSignedUploadUrlParams {
  organizationId: string;
  fileName: string;
}

/**
 * Bereinigt Dateinamen von unsicheren Pfad-Traversalen (..) und Sonderzeichen.
 */
export function sanitizeStorageFileName(rawFileName: string): string {
  const normalized = rawFileName
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '..' && segment !== '.')
    .join('-')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_()]/g, '')
    .replace(/\.{2,}/g, '.');

  const trimmed = normalized.replace(/^-+/, '').trim();
  return trimmed || 'document.bin';
}

/**
 * Erstellt eine signierte Upload-URL für den direkten Browser-Upload in Supabase Object Storage.
 * Pfad-Konvention: `${organizationId}/${uuid}-${sanitizedFileName}` für strikte RLS-Mandantenisolation (§ 203 StGB).
 */
export async function createSignedUploadUrl(
  supabase: SupabaseClient<Database>,
  params: CreateSignedUploadUrlParams
): Promise<CreateUploadUrlResponse> {
  const safeName = sanitizeStorageFileName(params.fileName);
  const fileId = crypto.randomUUID();
  const storagePath = `${params.organizationId}/${fileId}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(
      `Storage Upload-URL Erstellung fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`
    );
  }

  return {
    uploadUrl: data.signedUrl,
    storagePath,
    token: data.token,
  };
}

/**
 * Lädt eine Datei aus dem RLS-gesicherten Supabase Storage herunter und liefert einen Buffer zurück.
 */
export async function downloadFileBuffer(
  supabase: SupabaseClient<Database>,
  storagePath: string
): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Storage Download fehlgeschlagen: ${error?.message || 'Datei nicht gefunden'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Löst den Byte-Buffer einer Datei deterministisch auf:
 * - Primär über Supabase Object Storage (wenn storagePath vorhanden; der Client der Sitzung ist Pflicht)
 * - Fallback auf Base64 / Text-Content (für Legacy-Jobs oder lokale Test-Fixtures)
 */
export async function resolveFileBuffer(
  file: { name: string; content?: string; isBase64?: boolean; storagePath?: string },
  supabase?: SupabaseClient<Database> | null
): Promise<Buffer> {
  if (file.storagePath) {
    // Kein Rückfall auf einen Client ohne Sitzung: RLS gibt Dateien nur Mitgliedern der Kanzlei frei
    if (!supabase) {
      throw new Error(
        `Datei "${file.name}" liegt im Speicher, aber es wurde kein Sitzungs-Client für den Download übergeben.`
      );
    }
    return downloadFileBuffer(supabase, file.storagePath);
  }

  if (file.isBase64 && file.content) {
    const raw = file.content.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(raw, 'base64');
  }

  if (file.content !== undefined) {
    return Buffer.from(file.content, 'utf-8');
  }

  throw new Error(
    `Datei "${file.name}" enthält weder einen gültigen storagePath noch Dateiinhalt.`
  );
}
