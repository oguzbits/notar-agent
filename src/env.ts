import { z } from 'zod';

const optionalTrimmedString = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return val;
}, z.string().optional());

export const ServerEnvSchema = z.object({
  // KI-Provider Credentials
  ANTHROPIC_API_KEY: optionalTrimmedString,
  GEMINI_API_KEY: optionalTrimmedString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalTrimmedString,
  EVAL_GEMINI_API_KEY: optionalTrimmedString,
  EVAL_GEMINI_AI_MODEL: optionalTrimmedString,
  EVAL_ANTHROPIC_API_KEY: optionalTrimmedString,
  EVAL_ANTHROPIC_AI_MODEL: optionalTrimmedString,
  AI_MODEL: optionalTrimmedString.default('claude-haiku-5-5'),
  GEMINI_PARSE_MODEL: optionalTrimmedString.default('gemini-3.1-flash-lite'),
  GEMINI_PARSE_FALLBACK_MODEL: optionalTrimmedString.default('gemini-3.5-flash-lite'),
  AI_PROVIDER: optionalTrimmedString,
  MOCK_AI: z.preprocess(
    (val) => val === 'true' || val === true || val === '1',
    z.boolean().default(false)
  ),

  // Supabase Credentials (erforderlich)
  NEXT_SUPABASE_URL: optionalTrimmedString,
  NEXT_SUPABASE_PUBLISHABLE_KEY: optionalTrimmedString,

  // Hintergrundläufe (Cron): Service-Role-Key und Secret für den Cron-Aufruf
  SUPABASE_SERVICE_ROLE_KEY: optionalTrimmedString,
  CRON_SECRET: optionalTrimmedString,

  // Fehler-Tracking (Sentry EU); ohne DSN bleibt Sentry aus
  SENTRY_DSN: optionalTrimmedString,
});

export type Env = z.infer<typeof ServerEnvSchema>;

export function validateEnv(rawEnv: Record<string, string | undefined>): Env {
  // Graceful Fallback für Supabase URL
  const supabaseUrl = rawEnv.NEXT_SUPABASE_URL;

  const parsed = ServerEnvSchema.safeParse({
    ...rawEnv,
    NEXT_SUPABASE_URL: supabaseUrl,
  });

  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    throw new Error('Ungültige Umgebungsvariablen-Konfiguration');
  }

  return parsed.data;
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}

export const env = getEnv();
