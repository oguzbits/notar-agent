import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DB_TABLES, Database } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import {
  LastNotarError,
  SupabaseTeamRepository,
  TEAM_GUARD_SQLSTATE,
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
  ])('SQLSTATE %s wird zu %O', async (code, ErrorClass) => {
    const repo = new SupabaseTeamRepository(clientFailingWith(code));

    await expect(repo.updateMemberRole('m1', NOTARY_ROLES.ADMIN, org)).rejects.toThrow(ErrorClass);
    await expect(repo.removeMember('m1', org)).rejects.toThrow(ErrorClass);
  });

  it.each(['42501', '23514', 'XX000'])(
    'allgemeine SQLSTATE %s (RLS, CHECK, sonstige) bleibt ein technischer Fehler',
    async (code) => {
      const repo = new SupabaseTeamRepository(clientFailingWith(code));

      const error = await repo.removeMember('m1', org).catch((e: unknown) => e);
      expect(error).not.toBeInstanceOf(TeamSelfChangeError);
      expect(error).not.toBeInstanceOf(LastNotarError);
      expect(String(error)).toContain('Failed to remove member');
    }
  );
});

/** Mitglieder- und Profilabfrage mit je eigenem Ergebnis. */
function clientWithTables(
  members: { data: unknown; error: { message: string } | null },
  profiles: { data: unknown; error: { message: string } | null }
): SupabaseClient<Database> {
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    };
    for (const method of ['select', 'eq', 'in', 'order']) c[method] = () => c;
    return c;
  };
  return {
    from: (table: string) => chain(table === DB_TABLES.PROFILES ? profiles : members),
  } as never;
}

describe('SupabaseTeamRepository.listMembers: Profile der Kollegen', () => {
  const org = 'a0000000-0000-4000-8000-000000000001';
  const row = {
    id: 'm1',
    organization_id: org,
    user_id: 'u1',
    role: NOTARY_ROLES.SACHBEARBEITER,
    joined_at: '2026-01-01T00:00:00Z',
  };

  it('übernimmt Name, E-Mail und Titel aus dem Profil', async () => {
    const repo = new SupabaseTeamRepository(
      clientWithTables(
        { data: [row], error: null },
        {
          data: [{ id: 'u1', full_name: 'Frau Akte', email: 'akte@kanzlei.de', title: null }],
          error: null,
        }
      )
    );

    expect(await repo.listMembers(org)).toMatchObject([
      { id: 'm1', name: 'Frau Akte', email: 'akte@kanzlei.de' },
    ]);
  });

  it('wirft bei nicht lesbarem Profil statt einen Platzhalter zu erfinden', async () => {
    const repo = new SupabaseTeamRepository(
      clientWithTables({ data: [row], error: null }, { data: [], error: null })
    );

    await expect(repo.listMembers(org)).rejects.toThrow('nicht lesbar');
  });

  it('wirft, wenn die Profilabfrage fehlschlägt', async () => {
    const repo = new SupabaseTeamRepository(
      clientWithTables({ data: [row], error: null }, { data: null, error: { message: 'db down' } })
    );

    await expect(repo.listMembers(org)).rejects.toThrow('Failed to load member profiles: db down');
  });
});
