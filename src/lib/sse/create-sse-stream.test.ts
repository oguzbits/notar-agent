import { describe, it, expect } from 'vitest';
import { createSseStream, type SseEmitter } from './create-sse-stream';

describe('createSseStream', () => {
  it('erzeugt eine Response mit korrekten SSE-Headern', () => {
    const res = createSseStream(async (emitter: SseEmitter) => {
      emitter.sendEvent({ type: 'test' });
      emitter.close();
    });

    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('überträgt formatierte SSE-Events über den Stream', async () => {
    const res = createSseStream(async (emitter: SseEmitter) => {
      emitter.sendEvent({ type: 'step', step: 1 });
      emitter.sendEvent({ type: 'result', ok: true });
      emitter.close();
    });

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let accumulated = '';
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value);
    }

    expect(accumulated).toContain('data: {"type":"step","step":1}\n\n');
    expect(accumulated).toContain('data: {"type":"result","ok":true}\n\n');
  });

  it('sendet ein standardisiertes Error-Event, wenn der Executor fehlschlägt', async () => {
    const res = createSseStream(async () => {
      throw new Error('Testfehler im Handler');
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value);
    }

    expect(accumulated).toContain('data: {"type":"error","error":"Testfehler im Handler"}\n\n');
  });
});
