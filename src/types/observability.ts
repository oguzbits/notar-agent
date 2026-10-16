import { z } from 'zod';

export const LogLevelSchema = z.enum(['info', 'warn', 'error']);
export const LogOutcomeSchema = z.enum(['ok', 'fehler']);

/** Einziges erlaubtes Logformat: keine Freitexte, keine Fehlerobjekte (Berufsgeheimnis). */
export const LogEventSchema = z
  .object({
    level: LogLevelSchema,
    event: z.string(),
    stage: z.string().optional(),
    durationMs: z.number().nonnegative().optional(),
    model: z.string().optional(),
    jobId: z.string().optional(),
    organizationId: z.string().optional(),
    outcome: LogOutcomeSchema.optional(),
    errorClass: z.string().optional(),
  })
  .strict();

export type LogEvent = z.infer<typeof LogEventSchema>;
