import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// Öffentliche Seiten; angemeldete Ansichten folgen mit Sitzungs-Fixture.
const PUBLIC_PAGES = ['/login', '/register'];

// Web-Vitals-Richtwert „gut“; später per Ratsche verschärfen
const MAX_CLS = 0.1;

async function measureLayoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!shift.hadRecentInput) total += shift.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 1500);
      })
  );
}

for (const path of PUBLIC_PAGES) {
  test.describe(`Qualität ${path}`, () => {
    test('Layoutverschiebung bleibt unter dem Grenzwert', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(await measureLayoutShift(page)).toBeLessThanOrEqual(MAX_CLS);
    });

    test('keine schwerwiegenden Barrierefreiheitsverstöße (axe)', async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      expect(
        blocking.map((v) => `${v.id}: ${v.nodes.length}× ${v.help}`),
        'axe-Verstöße'
      ).toEqual([]);
    });
  });
}
