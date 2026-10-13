import { prepareFiles } from '@/lib/files/file-preparer';
import { UploadedFilePayload } from '@/types/dossier';
import { CreateUploadUrlResponse } from '@/types/storage';

export interface StorageUploadOptions {
  organizationId?: string;
  onProgress?: (fileName: string, progress: number) => void;
}

/**
 * Lädt eine Datei direkt vom Browser in den Supabase Object Storage hoch.
 * Überwindet das 4,5-MB-Vercel-Serverless-Body-Limit und vermeidet TOAST-Bloat in PostgreSQL.
 * Bei Fehlern (z.B. Offline/Mock) erfolgt ein sicherer Fallback auf lokale Base64-Extraktion.
 */
export async function uploadFileDirectly(
  file: File,
  options?: StorageUploadOptions
): Promise<UploadedFilePayload> {
  try {
    const urlRes = await fetch('/api/storage/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.organizationId ? { 'x-organization-id': options.organizationId } : {}),
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        organizationId: options?.organizationId,
      }),
    });

    if (!urlRes.ok) {
      throw new Error(`Upload-URL konnte nicht bezogen werden: HTTP ${urlRes.status}`);
    }

    const { uploadUrl, storagePath } = (await urlRes.json()) as CreateUploadUrlResponse;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Direktupload in Object Storage fehlgeschlagen: HTTP ${uploadRes.status}`);
    }

    return {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      storagePath,
    };
  } catch (err: unknown) {
    console.warn(
      '[storage-uploader] Direct-Upload fehlgeschlagen. Nutze lokalen Fallback für Datei:',
      file.name,
      err
    );
    const [fallbackPayload] = await prepareFiles([file]);
    if (!fallbackPayload) {
      throw new Error(`Fallback-Verarbeitung für Datei "${file.name}" fehlgeschlagen.`);
    }
    return fallbackPayload;
  }
}

/**
 * Lädt mehrere Dateien parallel hoch und sammelt die Payload-Referenzen.
 */
export async function uploadFilesDirectly(
  files: File[],
  options?: StorageUploadOptions
): Promise<UploadedFilePayload[]> {
  return Promise.all(files.map((file) => uploadFileDirectly(file, options)));
}
