import { NextResponse } from 'next/server';
import { AuthzError } from '@/lib/auth/require-permission';

/** Übersetzt einen Berechtigungsfehler des Guards in die 401/403-Antwort; andere Fehler liefern `undefined`. */
export function authzErrorResponse(error: unknown): NextResponse<{ error: string }> | undefined {
  if (!(error instanceof AuthzError)) return undefined;
  return NextResponse.json({ error: error.message }, { status: error.status });
}
