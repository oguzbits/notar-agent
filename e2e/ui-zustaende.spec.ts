import { test, expect } from './support/demo-session';
import { UEBERSICHT_FEHLER_TEXTS_DE } from '../src/lib/dossier/constants';

const SHOTS = process.env.UI_SHOTS_DIR;
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

test('Ladefehler der Übersicht zeigt Meldung und lädt per Wiederholen neu', async ({ page }) => {
  let fail = true;
  await page.route(/\/api\/jobs(\?|$)/, (route) =>
    fail ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.continue()
  );
  await page.route(/\/api\/documents(\?|$)/, (route) =>
    fail ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.continue()
  );
  await page.goto('/');

  await expect(page.getByText(UEBERSICHT_FEHLER_TEXTS_DE.LADEN)).toBeVisible({
    timeout: 15000, // Standard-Wiederholungen der Abfragen laufen zuerst ab
  });
  await shot(page, 'uebersicht-ladefehler');

  fail = false;
  await page.getByRole('button', { name: UEBERSICHT_FEHLER_TEXTS_DE.RETRY }).click();
  await expect(page.getByRole('heading', { name: 'Vorgangsübersicht' })).toBeVisible();
  await expect(page.getByText(UEBERSICHT_FEHLER_TEXTS_DE.LADEN)).toHaveCount(0);
});

test('unbekannter Job führt zur Nicht-gefunden-Ansicht und endet das Abfragen', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/jobs/unbekannt', (route) => {
    requests += 1;
    return route.fulfill({ status: 404, json: { error: 'nicht gefunden' } });
  });
  await page.goto('/?job=unbekannt');

  await expect(page.getByText('Hintergrund-Vorgang nicht gefunden')).toBeVisible();
  await shot(page, 'job-nicht-gefunden');
  const seen = requests;
  await page.waitForTimeout(4500);
  expect(requests).toBe(seen);
});
