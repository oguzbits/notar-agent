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
  EVAL_AI_MODEL: optionalTrimmedString.default('gemini-1.5-flash'),
  AI_MODEL: optionalTrimmedString.default('claude-haiku-4-5'),
  AI_PROVIDER: optionalTrimmedString,
  MOCK_AI: z.preprocess(
    (val) => val === 'true' || val === true || val === '1',
    z.boolean().default(false)
  ),

  // Supabase Credentials (optional für In-Memory-Modus)
  SUPABASE_URL: optionalTrimmedString,
  NEXT_PUBLIC_SUPABASE_URL: optionalTrimmedString,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalTrimmedString,
});

export type Env = z.infer<typeof ServerEnvSchema>;

export function validateEnv(rawEnv: Record<string, string | undefined>): Env {
  // Graceful Fallback für Supabase URL
  const supabaseUrl = rawEnv.NEXT_PUBLIC_SUPABASE_URL || rawEnv.SUPABASE_URL;

  const parsed = ServerEnvSchema.safeParse({
    ...rawEnv,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
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
