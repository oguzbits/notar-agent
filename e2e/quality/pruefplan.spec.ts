import { PRUEFPLAN_UI_TEXTS_DE as T } from '../../src/lib/dossier/constants';
import { expect, test } from '../support/demo-session';

const MAX_CLS = 0.1;

test('Prüfplan: Dialog öffnet ohne Layoutsprung, zeigt Regeln aus der Wissensbasis und bricht ohne Start ab', async ({
  page,
}) => {
  await page.goto('/?view=upload', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Muster-Kaufvertrag laden' }).click();

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

  await page.getByRole('button', { name: 'Unterlagen prüfen' }).click();
  const dialog = page.getByRole('dialog', { name: T.TITLE });
  await expect(dialog.getByRole('heading', { name: T.RULES })).toBeVisible();
  await expect(dialog.getByRole('button', { name: T.START })).toBeEnabled();

  await dialog.getByRole('button', { name: T.CANCEL }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Unterlagen prüfen' })).toBeVisible();
  expect(await shifts.evaluate((acc) => acc.total)).toBeLessThanOrEqual(MAX_CLS);
});
