export interface SseEmitter {
  sendEvent: (data: Record<string, unknown>) => void;
  close: () => void;
  error: (err: unknown) => void;
}

/**
 * Erzeugt eine Standard Next.js / Web API SSE-Response mit Text-Encoding und Fehler-Kapselung.
 */
export function createSseStream(executor: (emitter: SseEmitter) => Promise<void>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const emitter: SseEmitter = {
        sendEvent(data: Record<string, unknown>) {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (_streamClosedErr) {
            // Stream bereits abgebrochen
          }
        },
        close() {
          if (!isClosed) {
            isClosed = true;
            try {
              controller.close();
            } catch (_closeErr) {
              // Controller bereits geschlossen
            }
          }
        },
        error(err: unknown) {
          if (isClosed) return;
          const msg = err instanceof Error ? err.message : String(err);
          this.sendEvent({ type: 'error', error: msg });
          this.close();
        },
      };

      try {
        await executor(emitter);
      } catch (err) {
        emitter.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
