import { test as base } from '@playwright/test';

/** Test mit angemeldeter, isolierter Demo-Sitzung (anonym, eigene Kanzlei) auf lokaler Supabase. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const response = await page.request.post('/api/auth/demo', { data: {} });
    if (!response.ok()) {
      throw new Error(
        `Demo-Anmeldung fehlgeschlagen (${response.status()}): ${await response.text()}`
      );
    }
    await provide(page);
  },
});

export { expect } from '@playwright/test';
