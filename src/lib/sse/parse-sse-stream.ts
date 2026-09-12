/**
 * Reine SSE-Parser-Funktion als AsyncGenerator.
 * Entkoppelt Low-Level-Streambyte-Handling und SSE-Frame-Parsing von UI-Hooks und React.
 */
export async function* parseSseStream<T = unknown>(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<T, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr) as T;
            yield parsed;
          } catch (parseErr) {
            console.warn(
              '[parseSseStream] Ungültiges SSE-JSON-Payload verworfen:',
              jsonStr,
              parseErr
            );
          }
        }
      }
    }

    // Eventuellen Restpuffer am Stream-Ende auswerten
    if (buffer.trim().startsWith('data:')) {
      const jsonStr = buffer.trim().slice(5).trim();
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr) as T;
          yield parsed;
        } catch (parseErr) {
          console.warn(
            '[parseSseStream] Ungültiger abschließender SSE-Buffer verworfen:',
            jsonStr,
            parseErr
          );
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
