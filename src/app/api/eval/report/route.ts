import * as fs from 'node:fs';
import * as path from 'node:path';
import { NextResponse } from 'next/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const orgId = await resolveSessionOrganizationId(authSupabase);
    if (!orgId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      );
    }

    const jsonPath = path.resolve(process.cwd(), 'reports', 'eval-report.json');
    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json(
        { error: 'Kein Evaluierungsbericht gefunden. Bitte starte vorher: npm run eval:report' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Fehler beim Laden des Evaluierungsberichts.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
