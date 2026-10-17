import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createTestImmobilienDossier } from '../../src/test/fixtures/dossier-factory';
import { FIELD_STATUS } from '../../src/types/dossier';
import { expect, test } from '../support/demo-session';

const MAX_CLS = 0.1;

test('Prüfvermerk: Bestätigen ändert die Zeile ohne Layoutsprung', async ({ page }) => {
  const docId = randomUUID();
  const dossier = createTestImmobilienDossier({
    fieldStatusMap: { verkaeufer: FIELD_STATUS.VERIFIED },
  });
  // Vorgang direkt in der lokalen Datenbank der eigenen Demo-Kanzlei anlegen
  const me = await (await page.request.get('/api/auth/me')).json();
  const organizationId: string = me.organization.id;
  execFileSync('docker', [
    'exec',
    '-i',
    'supabase_db_notar-partner-prototyp-copy',
    'psql',
    '-U',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `INSERT INTO documents (id, organization_id, title, status, content) VALUES ('${docId}', '${organizationId}', 'Prüfprobe', 'DRAFT_READY', $json$${JSON.stringify(dossier)}$json$::jsonb);`,
  ]);

  await page.goto(`/?vorgang=${docId}`, { waitUntil: 'networkidle' });
  const confirm = page.getByRole('button', { name: 'Als geprüft bestätigen', exact: true }).first();
  await expect(confirm).toBeVisible();

  const shifts = await page.evaluateHandle(() => {
    const acc = { total: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!s.hadRecentInput) acc.total += s.value;
      }
    }).observe({ type: 'layout-shift' });
    return acc;
  });
  await confirm.click();
  await expect(page.getByText(/^Geprüft: /).first()).toBeVisible();
  const cls = await shifts.evaluate((acc) => acc.total);
  expect(cls).toBeLessThanOrEqual(MAX_CLS);
});
