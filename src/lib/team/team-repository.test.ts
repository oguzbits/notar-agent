import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { Database } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import { LastNotarError, SupabaseTeamRepository, TeamSelfChangeError } from './team-repository';

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
    ['42501', TeamSelfChangeError],
    ['23514', LastNotarError],
  ])('SQLSTATE %s wird zu %O', async (code, ErrorClass) => {
    const repo = new SupabaseTeamRepository(clientFailingWith(code));

    await expect(repo.updateMemberRole('m1', NOTARY_ROLES.ADMIN, org)).rejects.toThrow(ErrorClass);
    await expect(repo.removeMember('m1', org)).rejects.toThrow(ErrorClass);
  });

  it('andere Fehler bleiben technische Fehler', async () => {
    const repo = new SupabaseTeamRepository(clientFailingWith('XX000'));

    await expect(repo.removeMember('m1', org)).rejects.toThrow('Failed to remove member');
  });
});
