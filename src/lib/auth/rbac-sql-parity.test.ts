import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { NOTARY_ROLES } from '@/types/organization';
import { hasPermission } from './rbac';

const MIGRATION = 'supabase/migrations/20260915000000_core_multi_tenancy.sql';

function rolesOfPolicy(sql: string, policy: string): string[] {
  const statement = sql.split('\n').find((line) => line.includes(`CREATE POLICY ${policy} `));
  const list = statement?.match(/get_user_role\(organization_id\) IN \(([^)]*)\)/)?.[1];
  return (list?.match(/'([A-Z_]+)'/g) ?? []).map((quoted) => quoted.replaceAll("'", ''));
}

describe('RLS-Spiegel der Berechtigungsmatrix', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('rls_documents_delete erlaubt genau die Rollen mit DELETE_DOSSIER', () => {
    const expected = Object.values(NOTARY_ROLES)
      .filter((role) => hasPermission(role, PERMISSION_ACTIONS.DELETE_DOSSIER))
      .sort();

    expect(rolesOfPolicy(sql, 'rls_documents_delete').sort()).toEqual(expected);
  });
});
