import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { NOTARY_ROLES } from '@/types/organization';
import { hasPermission } from './rbac';

const JOBS = 'supabase/migrations/20260921000000_jobs_and_workflows.sql';

function rolesOfPolicy(sql: string, policy: string): string[] {
  const start = sql.indexOf(`CREATE POLICY ${policy}`);
  const statement = start < 0 ? '' : sql.slice(start, sql.indexOf(';', start));
  const list = statement.match(/get_user_role\(.*?\) IN \(([^)]*)\)/s)?.[1];
  return (list?.match(/'([A-Z_]+)'/g) ?? []).map((quoted) => quoted.replaceAll("'", ''));
}

describe('RLS-Spiegel der Berechtigungsmatrix', () => {
  const expected = Object.values(NOTARY_ROLES)
    .filter((role) => hasPermission(role, PERMISSION_ACTIONS.DELETE_DOSSIER))
    .sort();

  it.each([
    [JOBS, 'rls_jobs_delete'],
    [JOBS, '"RLS dossier_files delete"'],
  ])('%s: %s erlaubt genau die Rollen mit DELETE_DOSSIER', (file, policy) => {
    expect(rolesOfPolicy(readFileSync(file, 'utf8'), policy).sort()).toEqual(expected);
  });
});

describe('RLS-Spiegel des Prüfvermerks', () => {
  it('documents_guard_review erlaubt genau die Rollen mit OVERRIDE_FIELD_STATUS', () => {
    const sql = readFileSync('supabase/migrations/20260915000000_core_multi_tenancy.sql', 'utf8');
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION documents_guard_review');
    const body = sql.slice(start, sql.indexOf('$$ LANGUAGE', start));
    const roles = (body.match(/IN \(([^)]*)\)/s)?.[1]?.match(/'([A-Z_]+)'/g) ?? []).map((quoted) =>
      quoted.replaceAll("'", '')
    );
    const expected = Object.values(NOTARY_ROLES).filter((role) =>
      hasPermission(role, PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS)
    );

    expect(roles.sort()).toEqual(expected.sort());
  });
});
