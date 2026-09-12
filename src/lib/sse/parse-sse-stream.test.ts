import { describe, it, expect } from 'vitest';
import { parseSseStream } from './parse-sse-stream';

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('parseSseStream', () => {
  it('parses valid SSE data events correctly', async () => {
    const stream = createMockStream([
      'data: {"type": "step", "step": 1}\n\n',
      'data: {"type": "step", "step": 2}\n\n',
      'data: {"type": "result", "success": true}\n\n',
    ]);

    const events: unknown[] = [];
    for await (const event of parseSseStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'step', step: 1 },
      { type: 'step', step: 2 },
      { type: 'result', success: true },
    ]);
  });

  it('handles chunk splitting across boundaries and trailing buffers', async () => {
    const stream = createMockStream([
      'data: {"type": "st',
      'ep", "step": 1}\n\ndata: {"ty',
      'pe": "step", "step": 2}\n',
      '\ndata: {"type": "result"}\n\n',
    ]);

    const events: unknown[] = [];
    for await (const event of parseSseStream(stream)) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'step', step: 1 });
    expect(events[1]).toEqual({ type: 'step', step: 2 });
    expect(events[2]).toEqual({ type: 'result' });
  });

  it('ignores comments or empty lines', async () => {
    const stream = createMockStream([': comment line\n\n', '\n\n', 'data: {"type": "ping"}\n\n']);

    const events: unknown[] = [];
    for await (const event of parseSseStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'ping' }]);
  });
});
