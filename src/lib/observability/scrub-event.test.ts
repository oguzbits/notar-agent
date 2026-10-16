import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent } from './scrub-event';

const sensitive: ErrorEvent = {
  type: undefined,
  message: 'Vertrag Müller',
  exception: {
    values: [
      {
        type: 'TypeError',
        value: 'Vertrag Müller',
        stacktrace: { frames: [{ filename: 'a.ts', function: 'f', vars: { name: 'Müller' } }] },
      },
    ],
  },
  request: {
    url: 'https://x.de/api/analyze?doc=Mueller',
    data: 'Inhalt',
    cookies: { sb: 'token' },
    headers: { authorization: 'Bearer x' },
  },
  user: { email: 'a@b.de' },
  extra: { text: 'Inhalt' },
  contexts: { os: { name: 'mac' } },
  breadcrumbs: [{ message: 'Inhalt' }],
  tags: { job_id: 'j1', organization_id: 'o1', sonst: 'x' },
};

describe('scrubEvent', () => {
  it('entfernt Inhalte, Meldungstexte und personenbezogene Felder', () => {
    const out = scrubEvent(structuredClone(sensitive));
    const json = JSON.stringify(out);
    for (const leak of ['Müller', 'Inhalt', 'token', 'Bearer', 'a@b.de', 'Mueller']) {
      expect(json).not.toContain(leak);
    }
  });

  it('behält Fehlertyp, Route ohne Query sowie job_id und organization_id', () => {
    const out = scrubEvent(structuredClone(sensitive));
    expect(out.exception?.values?.[0]?.type).toBe('TypeError');
    expect(out.request?.url).toBe('https://x.de/api/analyze');
    expect(out.tags).toEqual({ job_id: 'j1', organization_id: 'o1' });
  });

  it('wirft nicht bei Ereignissen ohne Exception und Request', () => {
    expect(() => scrubEvent({ type: undefined })).not.toThrow();
  });

  it('verwirft Breadcrumbs vollständig', () => {
    expect(scrubBreadcrumb()).toBeNull();
  });
});
