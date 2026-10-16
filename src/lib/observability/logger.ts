import { LogEventSchema, type LogEvent } from '@/types/observability';

export function logEvent(event: LogEvent): void {
  const parsed = LogEventSchema.parse(event);
  console[parsed.level](JSON.stringify(parsed));
}

export function errorClassOf(err: unknown): string {
  return err instanceof Error ? err.constructor.name : 'UnbekannterFehler';
}

export async function timed<T>(
  base: Pick<LogEvent, 'event' | 'stage' | 'model' | 'jobId' | 'organizationId'>,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  const durationMs = () => Math.round(performance.now() - start);
  try {
    const result = await fn();
    logEvent({
      ...base,
      level: 'info',
      outcome: 'ok',
      durationMs: durationMs(),
    });
    return result;
  } catch (err) {
    logEvent({
      ...base,
      level: 'error',
      outcome: 'fehler',
      durationMs: durationMs(),
      errorClass: errorClassOf(err),
    });
    throw err;
  }
}
