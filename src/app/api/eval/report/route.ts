import * as fs from 'node:fs';
import * as path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
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
