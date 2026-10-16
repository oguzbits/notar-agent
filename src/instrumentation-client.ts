import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions } from '@/lib/observability/sentry-options';

// Der DSN ist öffentlich (im Browser sichtbar) und deshalb eine eigene NEXT_PUBLIC-Variable.
const options = buildSentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN);
if (options) Sentry.init(options);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
