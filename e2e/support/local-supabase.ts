import { execFileSync } from 'node:child_process';

/**
 * Liefert die Umgebung der lokalen Supabase für den App-Server der E2E-Läufe.
 * Hintergrund: .env.local zeigt häufig auf das Live-Projekt. E2E-Läufe legen anonyme
 * Benutzer und Kanzleien an und dürfen deshalb nie gegen Live laufen.
 */
export function localSupabaseEnv(): Record<string, string> {
  const raw = execFileSync('npx', ['--yes', 'supabase@2.120.0', 'status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const values = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (match?.[1] && match[2] !== undefined) values.set(match[1], match[2]);
  }
  const url = values.get('API_URL');
  const key = values.get('ANON_KEY');
  if (!url || !key) {
    throw new Error('Lokale Supabase nicht erreichbar. Bitte zuerst `npm run db:start` ausführen.');
  }
  return { NEXT_SUPABASE_URL: url, NEXT_SUPABASE_PUBLISHABLE_KEY: key };
}
