import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { TEAM_GUARD_SQLSTATE } from './team-repository';

/**
 * Statische Prüfung der Trigger-Funktion in der Core-Migration (das Verhalten gegen echtes Postgres
 * deckt src/test/db/team-guard.db.test.ts ab, läuft aber nur mit lokaler Supabase).
 */
describe('Trigger organization_members_guard (Migration)', () => {
  const sql = readFileSync('supabase/migrations/20260915000000_core_multi_tenancy.sql', 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION organization_members_guard');
  const body = sql.slice(start, sql.indexOf('$$ LANGUAGE', start));
  const squash = (text: string) => text.replace(/\s+/g, ' ');

  it('Änderung oder Löschung einer NOTAR-Mitgliedschaft nur durch einen NOTAR (42501)', () => {
    const notar = NOTARY_ROLES.NOTAR;
    expect(squash(body)).toMatch(
      new RegExp(
        `IF OLD\\.role = '${notar}' AND get_user_role\\(OLD\\.organization_id\\) IS DISTINCT FROM '${notar}' ` +
          `THEN RAISE EXCEPTION '[^']+' USING ERRCODE = '42501';`
      )
    );
  });

  it('der Schutz des letzten NOTAR und der Selbständerung bleibt, mit den Codes der Anwendung', () => {
    expect(body).toContain(`ERRCODE = '${TEAM_GUARD_SQLSTATE.SELF_CHANGE}'`);
    expect(body).toContain(`ERRCODE = '${TEAM_GUARD_SQLSTATE.LAST_NOTAR}'`);
  });
});
