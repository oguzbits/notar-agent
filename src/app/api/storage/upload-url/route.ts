import { NextRequest, NextResponse } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { createSignedUploadUrl } from '@/lib/storage/storage-service';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { CreateUploadUrlRequestSchema } from '@/types/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    if (!authSupabase) {
      return NextResponse.json(
        { error: 'Supabase-Authentifizierungsclient nicht verfügbar.' },
        { status: 500 }
      );
    }

    const body: unknown = await req.json().catch(() => ({}));
    const parseResult = CreateUploadUrlRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Ungültige Anfrage für Upload-URL.',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { fileName, fileSize, organizationId: requestedOrgId } = parseResult.data;

    const queryOrgId = req.headers.get('x-organization-id') || requestedOrgId || undefined;

    const { organizationId: orgId } = await requirePermission(
      authSupabase,
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      { requestedOrgId: queryOrgId, route: 'POST /api/storage/upload-url' }
    );

    // 50 MB Hardlimit für Object Storage (gem. Bucket-Konfiguration)
    const MAX_STORAGE_FILE_SIZE = 50 * 1024 * 1024;
    if (fileSize > MAX_STORAGE_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Die Datei überschreitet das Limit von 50 MB für den Object Storage.`,
        },
        { status: 400 }
      );
    }

    const uploadData = await createSignedUploadUrl(authSupabase, {
      organizationId: orgId,
      fileName,
    });

    return NextResponse.json(uploadData, { status: 201 });
  } catch (err: unknown) {
    const denied = authzErrorResponse(err);
    if (denied) return denied;
    const msg =
      err instanceof Error ? err.message : 'Fehler bei der Generierung der signierten Upload-URL.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
