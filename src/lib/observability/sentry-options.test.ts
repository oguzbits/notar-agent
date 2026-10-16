import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent } from './scrub-event';
import { buildSentryOptions } from './sentry-options';

const EU_DSN = 'https://key@o123.ingest.de.sentry.io/456';

describe('buildSentryOptions', () => {
  it('liefert ohne DSN null, damit Sentry nicht initialisiert wird', () => {
    expect(buildSentryOptions(undefined)).toBeNull();
  });

  it('schaltet alle Inhaltsfelder ab und setzt die Scrubber', () => {
    const o = buildSentryOptions(EU_DSN);
    expect(o?.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    });
    expect(o?.dataCollection?.httpHeaders).toEqual({ request: false, response: false });
    expect(o?.beforeSend).toBe(scrubEvent);
    expect(o?.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  it('sendet keine Transaktionen: kein Tracing und beforeSendTransaction verwirft alles', () => {
    const o = buildSentryOptions(EU_DSN);
    expect(o).not.toHaveProperty('tracesSampleRate');
    expect(o?.beforeSendTransaction?.({ type: 'transaction' }, {})).toBeNull();
  });

  it('lehnt DSNs außerhalb der EU-Region ab', () => {
    expect(() => buildSentryOptions('https://key@o1.ingest.sentry.io/2')).toThrow();
    expect(() => buildSentryOptions('https://key@o1.ingest.de.sentry.io.evil.com/2')).toThrow();
    expect(() => buildSentryOptions('kein-dsn')).toThrow();
  });
});
