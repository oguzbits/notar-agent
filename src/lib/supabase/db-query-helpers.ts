import { PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';

export interface QueryFilterable<T> {
  eq(column: string, value: unknown): T;
}

/**
 * Wendet optional die Mandanten-Filterung auf einen Query-Builder an.
 */
export function applyOrganizationFilter<T extends QueryFilterable<T>>(
  query: T,
  organizationId?: string
): T {
  if (organizationId) {
    return query.eq('organization_id', organizationId);
  }
  return query;
}

/**
 * Führt eine maybeSingle()-Abfrage mit standardisiertem Fail-Fast-Fehler-Handling aus.
 */
export async function executeMaybeSingle<T>(
  query: PromiseLike<PostgrestSingleResponse<T>>,
  actionContext: string
): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase ${actionContext} error: ${error.message}`);
  }
  return data;
}

/**
 * Führt eine Listen-Abfrage mit standardisiertem Fail-Fast-Fehler-Handling aus.
 */
export async function executeList<T>(
  query: PromiseLike<PostgrestResponse<T>>,
  actionContext: string
): Promise<T[]> {
  const { data, error } = await query;
  if (error || !data) {
    throw new Error(
      `Supabase ${actionContext} fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
    );
  }
  return data;
}
