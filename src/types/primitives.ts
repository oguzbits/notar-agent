import { z } from 'zod';

/**
 * Kanonischer Regex für relationale PostgreSQL-Identifikatoren (128-Bit Hex im Format 8-4-4-4-12).
 * Akzeptiert auch sequentielle/Null-basierte DB-Seeds (z. B. d0000000-0000-0000-0000-000000000001).
 */
export const PG_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Kanonisches UUID-Schema für relationale Identifikatoren.
 */
export const DbUuidSchema = z
  .string()
  .regex(PG_UUID_REGEX, 'Ungültige UUID (erwartet 128-Bit Hex im Format 8-4-4-4-12)');
