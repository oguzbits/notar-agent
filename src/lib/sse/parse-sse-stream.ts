import { createParser } from 'eventsource-parser';

/**
 * Reine SSE-Parser-Funktion als AsyncGenerator via eventsource-parser.
 * Entkoppelt Low-Level-Streambyte-Handling und SSE-Frame-Parsing von UI-Hooks und React.
 */
export async function* parseSseStream<T = unknown>(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<T, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const queue: T[] = [];

  const parser = createParser({
    onEvent(event) {
      if (event.data) {
        try {
          const parsed = JSON.parse(event.data) as T;
          queue.push(parsed);
        } catch (parseErr) {
          console.warn(
            '[parseSseStream] Ungültiges SSE-JSON-Payload verworfen:',
            event.data,
            parseErr
          );
        }
      }
    },
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      parser.feed(decoder.decode(value, { stream: true }));
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) {
          yield item;
        }
      }
    }

    // Eventuell verbleibende Events nach Stream-Ende
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        yield item;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
