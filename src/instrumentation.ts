import * as Sentry from '@sentry/nextjs';
import { getEnv } from '@/env';
import { parseRequestId, REQUEST_ID_HEADER } from '@/lib/observability/request-id';
import { buildSentryOptions } from '@/lib/observability/sentry-options';

export function register(): void {
  const options = buildSentryOptions(getEnv().SENTRY_DSN);
  if (options) Sentry.init(options);
}

/** Wie `Sentry.captureRequestError`, zusätzlich mit der (validierten) Request-Kennung als Tag. */
export function onRequestError(...args: Parameters<typeof Sentry.captureRequestError>): void {
  const [, request] = args;
  const header = request.headers[REQUEST_ID_HEADER];
  const requestId = parseRequestId(Array.isArray(header) ? undefined : header);
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag('request_id', requestId);
    Sentry.captureRequestError(...args);
  });
}
