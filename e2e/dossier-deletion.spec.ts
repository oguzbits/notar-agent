import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test, expect } from './support/demo-session';
import { DELETION_REASON_LABELS_DE, DELETION_UI_TEXTS_DE } from '../src/lib/dossier/constants';
import { DELETION_REASONS } from '../src/types/deletion';

test('Löschdialog verlangt einen Grund und entfernt den Vorgang', async ({ page }) => {
  const docId = randomUUID();
  // Der Vorgang wird direkt in der lokalen Datenbank der neuesten Demo-Kanzlei angelegt.
  execFileSync('docker', [
    'exec',
    'supabase_db_notar-partner-prototyp-copy',
    'psql',
    '-U',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `INSERT INTO documents (id, organization_id, title, status) SELECT '${docId}', organization_id, 'Löschprobe', 'DRAFT' FROM organization_members m ORDER BY (SELECT created_at FROM auth.users u WHERE u.id = m.user_id) DESC LIMIT 1;`,
  ]);

  await page.goto('/');
  await page
    .getByRole('button', { name: /löschen/i })
    .first()
    .click();

  const confirm = page.getByRole('button', { name: DELETION_UI_TEXTS_DE.CONFIRM });
  await expect(confirm).toBeDisabled();
  await page
    .getByRole('button', { name: DELETION_REASON_LABELS_DE[DELETION_REASONS.FEHLERHAFT_ANGELEGT] })
    .click();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('Löschprobe')).toHaveCount(0);
});
