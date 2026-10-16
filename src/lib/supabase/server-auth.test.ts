import { describe, it, expect } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import { resolveSessionActor, resolveSessionOrganizationId } from './server-auth';

type AuthClient = NonNullable<Parameters<typeof resolveSessionOrganizationId>[0]>;

const ORG_A = 'a0000000-0000-4000-8000-00000000000a';
const ORG_B = 'b0000000-0000-4000-8000-00000000000b';

interface FakeOptions {
  user?: { id: string; email?: string } | null;
  memberships?: { organization_id: string; role?: string }[];
  memberError?: { message: string } | null;
  profileName?: string | null;
}

// Test-Double deckt nur die genutzte Teilmenge des Supabase-Clients ab
function isFakeAuthClient(value: unknown): value is AuthClient {
  return typeof value === 'object' && value !== null && 'auth' in value && 'from' in value;
}

function fakeClient(opts: FakeOptions): AuthClient {
  const rows = opts.memberships ?? [];
  const builder = (table: string) => {
    let orgFilter: string | undefined;
    const chain = {
      select: () => chain,
      eq: (column: string, value: string) => {
        if (column === 'organization_id') orgFilter = value;
        return chain;
      },
      maybeSingle: async () => {
        if (table === DB_TABLES.PROFILES) {
          return { data: opts.profileName ? { full_name: opts.profileName } : null, error: null };
        }
        const row = rows.find((r) => !orgFilter || r.organization_id === orgFilter);
        return { data: row ?? null, error: opts.memberError ?? null };
      },
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: rows, error: opts.memberError ?? null }),
    };
    return chain;
  };
  const client: unknown = {
    auth: {
      getUser: async () => ({
        data: { user: opts.user === undefined ? { id: 'u1' } : opts.user },
        error: null,
      }),
    },
    from: builder,
  };
  if (!isFakeAuthClient(client)) throw new Error('Fake-Client ungültig');
  return client;
}

describe('resolveSessionOrganizationId', () => {
  it('liefert undefined ohne Sitzung, auch wenn eine Kanzlei angefordert wird', async () => {
    const client = fakeClient({ user: null, memberships: [{ organization_id: ORG_A }] });
    expect(await resolveSessionOrganizationId(client, ORG_A)).toBeUndefined();
  });

  it('verweigert eine fremde Kanzlei, in der kein Mitglied besteht', async () => {
    const client = fakeClient({ memberships: [{ organization_id: ORG_A }] });
    expect(await resolveSessionOrganizationId(client, ORG_B)).toBeUndefined();
  });

  it('akzeptiert eine angeforderte Kanzlei mit Mitgliedschaft', async () => {
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A }, { organization_id: ORG_B }],
    });
    expect(await resolveSessionOrganizationId(client, ORG_B)).toBe(ORG_B);
  });

  it('nimmt ohne Anforderung die erste Mitgliedschaft', async () => {
    const client = fakeClient({ memberships: [{ organization_id: ORG_A }] });
    expect(await resolveSessionOrganizationId(client)).toBe(ORG_A);
  });

  it('liefert undefined ohne Mitgliedschaft', async () => {
    expect(await resolveSessionOrganizationId(fakeClient({ memberships: [] }))).toBeUndefined();
  });

  it('wirft bei Datenbankfehler statt still zu scheitern', async () => {
    const client = fakeClient({ memberError: { message: 'boom' } });
    await expect(resolveSessionOrganizationId(client)).rejects.toThrow('boom');
  });
});

describe('resolveSessionActor', () => {
  it('liefert undefined ohne Sitzung', async () => {
    const client = fakeClient({ user: null });
    expect(await resolveSessionActor(client, ORG_A)).toBeUndefined();
  });

  it('liefert undefined ohne Mitgliedschaft in der Kanzlei', async () => {
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.NOTAR }],
    });
    expect(await resolveSessionActor(client, ORG_B)).toBeUndefined();
  });

  it('nimmt Rolle aus der Mitgliedschaft und Namen aus dem Profil', async () => {
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.NOTARASSESSOR }],
      profileName: 'Dr. Muster',
    });
    expect(await resolveSessionActor(client, ORG_A)).toEqual({
      userId: 'u1',
      label: 'Dr. Muster',
      role: NOTARY_ROLES.NOTARASSESSOR,
    });
  });

  it('fällt ohne Profilnamen auf die E-Mail zurück', async () => {
    const client = fakeClient({
      user: { id: 'u1', email: 'a@b.de' },
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.NOTAR }],
    });
    expect((await resolveSessionActor(client, ORG_A))?.label).toBe('a@b.de');
  });
});
