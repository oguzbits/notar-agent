import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { Database } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import {
  LastNotarError,
  SupabaseTeamRepository,
  TEAM_GUARD_SQLSTATE,
  TeamRoleNotPermittedError,
  TeamSelfChangeError,
} from './team-repository';

/** Abfragekette, die am Ende den Datenbankfehler des Triggers organization_members_guard liefert. */
function clientFailingWith(code: string): SupabaseClient<Database> {
  const result = { data: null, error: { code, message: 'abgelehnt' } };
  const chain: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  for (const method of ['update', 'delete', 'eq', 'select']) chain[method] = () => chain;
  chain.maybeSingle = async () => result;
  return { from: () => chain } as never;
}

describe('SupabaseTeamRepository: Ablehnungen der Datenbank', () => {
  const org = 'a0000000-0000-4000-8000-000000000001';

  it.each([
    [TEAM_GUARD_SQLSTATE.SELF_CHANGE, TeamSelfChangeError],
    [TEAM_GUARD_SQLSTATE.LAST_NOTAR, LastNotarError],
    ['42501', TeamRoleNotPermittedError],
  ])('SQLSTATE %s wird zu %O', async (code, ErrorClass) => {
    const repo = new SupabaseTeamRepository(clientFailingWith(code));

    await expect(repo.updateMemberRole('m1', NOTARY_ROLES.ADMIN, org)).rejects.toThrow(ErrorClass);
    await expect(repo.removeMember('m1', org)).rejects.toThrow(ErrorClass);
  });

  it.each(['23514', 'XX000'])(
    'allgemeine SQLSTATE %s (CHECK, sonstige) bleibt ein technischer Fehler',
    async (code) => {
      const repo = new SupabaseTeamRepository(clientFailingWith(code));

      const error = await repo.removeMember('m1', org).catch((e: unknown) => e);
      expect(error).not.toBeInstanceOf(TeamSelfChangeError);
      expect(error).not.toBeInstanceOf(LastNotarError);
      expect(String(error)).toContain('Failed to remove member');
    }
  );
});
