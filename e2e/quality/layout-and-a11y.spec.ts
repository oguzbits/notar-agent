import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { test as sessionTest } from '../support/demo-session';

const PUBLIC_PAGES = ['/login', '/register'];
// Angemeldete Ansichten (isolierte Demo-Sitzung auf lokaler Supabase)
const SESSION_PAGES = ['/', '/?view=upload'];

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

function registerChecks(runner: typeof test, paths: string[]) {
  for (const path of paths) {
    runner.describe(`Qualität ${path}`, () => {
      runner('Layoutverschiebung bleibt unter dem Grenzwert', async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' });
        expect(await measureLayoutShift(page)).toBeLessThanOrEqual(MAX_CLS);
      });

      runner('keine schwerwiegenden Barrierefreiheitsverstöße (axe)', async ({ page }) => {
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
}

registerChecks(test, PUBLIC_PAGES);
registerChecks(sessionTest, SESSION_PAGES);
