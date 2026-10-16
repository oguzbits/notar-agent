import { afterEach, describe, expect, it, vi } from 'vitest';
import { LLM_USAGE_STAGES } from '@/types/llm-usage';
import { LogEventSchema } from '@/types/observability';
import { errorClassOf, logEvent, logFailure, timed } from './logger';

afterEach(() => vi.restoreAllMocks());

describe('LogEventSchema', () => {
  it('lehnt unbekannte Felder ab', () => {
    const r = LogEventSchema.safeParse({ level: 'info', event: 'x', message: 'Freitext' });
    expect(r.success).toBe(false);
  });
});

describe('logEvent', () => {
  it('schreibt eine JSON-Zeile ohne fehlende Felder', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logEvent({ level: 'info', event: 'e', jobId: undefined });
    const line = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line).toEqual({ level: 'info', event: 'e' });
  });
});

describe('timed', () => {
  it('loggt Dauer und ok bei Erfolg', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(
      timed({ event: 'pipeline_stage', stage: LLM_USAGE_STAGES.EXTRACTION }, async () => 7)
    ).resolves.toBe(7);
    const line = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ outcome: 'ok', stage: LLM_USAGE_STAGES.EXTRACTION });
    expect(line.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('loggt nur die Fehlerklasse und wirft weiter', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      timed({ event: 'pipeline_stage' }, async () => {
        throw new TypeError('Vertrag Müller');
      })
    ).rejects.toThrow('Vertrag Müller');
    const raw = String(spy.mock.calls[0]?.[0]);
    expect(raw).not.toContain('Müller');
    expect(JSON.parse(raw)).toMatchObject({ outcome: 'fehler', errorClass: 'TypeError' });
    expect(JSON.parse(raw).durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('errorClassOf', () => {
  it('liefert Klassenname oder Fallback', () => {
    expect(errorClassOf(new RangeError('x'))).toBe('RangeError');
    expect(errorClassOf('text')).toBe('UnbekannterFehler');
  });
});

describe('logFailure', () => {
  it('loggt nur Ereignis und Fehlerklasse', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logFailure('warn', 'x_fehlgeschlagen', new Error('Vertrag Müller'));
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toEqual({
      level: 'warn',
      event: 'x_fehlgeschlagen',
      errorClass: 'Error',
    });
  });
});
