import type { NodeOptions } from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from './scrub-event';

const EU_INGEST_SUFFIX = '.ingest.de.sentry.io';

/** Nur EU-Region (Frankfurt); alles andere ist ein Konfigurationsfehler. */
function assertEuDsn(dsn: string): void {
  let host: string;
  try {
    host = new URL(dsn).hostname;
  } catch (err: unknown) {
    throw new Error('SENTRY_DSN ist keine gültige URL.', { cause: err });
  }
  if (!host.endsWith(EU_INGEST_SUFFIX)) {
    throw new Error('SENTRY_DSN muss auf die EU-Region (de.sentry.io) zeigen.');
  }
}

/** `null` ohne DSN: dann wird Sentry gar nicht erst initialisiert. */
export function buildSentryOptions(dsn: string | undefined): NodeOptions | null {
  if (!dsn) return null;
  assertEuDsn(dsn);
  return {
    dsn,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
