import { LogEventSchema, type LogEvent } from '@/types/observability';
import { parseRequestId } from './request-id';

export function logEvent(event: LogEvent): void {
  const parsed = LogEventSchema.parse(event);
  console[parsed.level](JSON.stringify(parsed));
}

export function errorClassOf(err: unknown): string {
  return err instanceof Error ? err.constructor.name : 'UnbekannterFehler';
}

/** `requestId` stammt aus dem Request-Header; eine ungültige wird verworfen statt den Log zu stören. */
export function logFailure(
  level: LogEvent['level'],
  event: string,
  err: unknown,
  requestId?: string | null
): void {
  logEvent({ level, event, errorClass: errorClassOf(err), requestId: parseRequestId(requestId) });
}

export async function timed<T>(
  base: Pick<LogEvent, 'event' | 'stage' | 'model' | 'jobId' | 'organizationId' | 'requestId'>,
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
