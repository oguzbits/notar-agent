import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

const ALLOWED_TAGS = ['job_id', 'organization_id'] as const;

/** Allowlist statt Denylist: nur Fehlertyp, Frames ohne Variablen, Route und IDs verlassen den Server. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const tags: Record<string, string> = {};
  for (const key of ALLOWED_TAGS) {
    const value = event.tags?.[key];
    if (typeof value === 'string') tags[key] = value;
  }

  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    exception: event.exception && {
      values: event.exception.values?.map((v) => ({
        type: v.type,
        stacktrace: v.stacktrace && {
          frames: v.stacktrace.frames?.map(({ vars: _vars, ...frame }) => frame),
        },
      })),
    },
    request: event.request?.url ? { url: event.request.url.split('?')[0] } : undefined,
    tags,
  };
}

export function scrubBreadcrumb(): Breadcrumb | null {
  return null;
}
