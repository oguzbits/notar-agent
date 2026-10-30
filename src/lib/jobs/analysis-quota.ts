import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { DemoAnalysisUsage } from '@/types/jobs';

/** Analyseläufe (Hintergrund-Jobs und Live-Läufe) einer Kanzlei seit sinceIso; gezählt in PostgreSQL. */
export async function countAnalysisRunsSince(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  sinceIso: string
): Promise<number> {
  const { data, error } = await supabase.rpc('count_analysis_runs_since', {
    p_organization_id: organizationId,
    p_since: sinceIso,
  });
  if (error) {
    throw new Error(`Supabase countAnalysisRunsSince fehlgeschlagen: ${error.message}`);
  }
  return data ?? 0;
}

/** Demo-Status der Kanzlei und Läufe seit sinceIso (je Kanzlei und über alle Demo-Kanzleien); ohne Mitgliedschaft keine Zeile. */
export async function getDemoAnalysisUsage(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  sinceIso: string
): Promise<DemoAnalysisUsage> {
  const { data, error } = await supabase.rpc('demo_analysis_usage_since', {
    p_organization_id: organizationId,
    p_since: sinceIso,
  });
  const row = data?.[0];
  if (error || !row) {
    throw new Error(
      `Supabase getDemoAnalysisUsage fehlgeschlagen: ${error?.message ?? 'keine Mitgliedschaft'}`
    );
  }
  return {
    isDemo: row.is_demo,
    organizationRuns: row.organization_runs,
    totalRuns: row.total_runs,
  };
}
