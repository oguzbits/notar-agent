import * as Sentry from '@sentry/nextjs';
import { getEnv } from '@/env';
import { buildSentryOptions } from '@/lib/observability/sentry-options';

export function register(): void {
  const options = buildSentryOptions(getEnv().SENTRY_DSN);
  if (options) Sentry.init(options);
}

export const onRequestError = Sentry.captureRequestError;
