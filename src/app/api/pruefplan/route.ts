import { NextRequest, NextResponse } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { buildPruefplan } from '@/lib/dossier/pruefplan';
import { logFailure } from '@/lib/observability/logger';
import { getKnowledgeRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { CaseTypeSchema } from '@/types/dossier';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const caseType = CaseTypeSchema.safeParse(req.nextUrl.searchParams.get('caseType'));
    if (!caseType.success) {
      return NextResponse.json({ error: 'Ungültige Vorgangsart.' }, { status: 400 });
    }

    const authSupabase = await createServerAuthClient();
    const { organizationId } = await requirePermission(
      authSupabase,
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      {
        requestedOrgId: req.headers.get('x-organization-id') ?? undefined,
        route: 'GET /api/pruefplan',
      }
    );

    const rules = await getKnowledgeRepository(authSupabase).getStatutoryRules(organizationId);
    return NextResponse.json(buildPruefplan(caseType.data, rules));
  } catch (error: unknown) {
    const denied = authzErrorResponse(error);
    if (denied) return denied;
    logFailure('error', 'pruefplan_fehlgeschlagen', error);
    return NextResponse.json({ error: 'Prüfplan konnte nicht geladen werden.' }, { status: 500 });
  }
}
