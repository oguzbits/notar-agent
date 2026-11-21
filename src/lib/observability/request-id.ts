import { RequestIdSchema } from '@/types/observability';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Gültige Kennung oder `undefined` (keine Ersatzkennung, z. B. für Logs außerhalb eines Requests). */
export function parseRequestId(incoming: string | null | undefined): string | undefined {
  const parsed = RequestIdSchema.safeParse(incoming);
  return parsed.success ? parsed.data : undefined;
}

/** Übernimmt eine gültige Kennung des Clients, sonst eine neue (Client-Eingabe gelangt in Logs). */
export function resolveRequestId(incoming: string | null | undefined): string {
  return parseRequestId(incoming) ?? crypto.randomUUID();
}
