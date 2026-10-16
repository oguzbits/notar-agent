import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS } from '@/types/audit';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import { AuthzError, requirePermission } from './require-permission';

const appendEvent = vi.fn();
vi.mock('@/lib/audit/audit-repository', () => ({
  SupabaseAuditRepository: class {
    appendEvent = appendEvent;
  },
}));

type Client = NonNullable<Parameters<typeof requirePermission>[0]>;

const USER_ID = 'c0000000-0000-4000-8000-0000000000c1';
const ORG_A = 'a0000000-0000-4000-8000-00000000000a';
const ORG_B = 'b0000000-0000-4000-8000-00000000000b';

interface FakeOptions {
  user?: { id: string; email?: string } | null;
  memberships?: { organization_id: string; role: string }[];
  memberError?: { message: string } | null;
}

// Test-Double deckt nur die vom Guard genutzte Teilmenge des Supabase-Clients ab
function isClient(value: unknown): value is Client {
  return typeof value === 'object' && value !== null && 'auth' in value && 'from' in value;
}

function fakeClient(opts: FakeOptions): Client {
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
        if (table === DB_TABLES.PROFILES) return { data: { full_name: 'Frau Weber' }, error: null };
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
        data: { user: opts.user === undefined ? { id: USER_ID } : opts.user },
        error: null,
      }),
    },
    from: builder,
  };
  if (!isClient(client)) throw new Error('Fake-Client ungültig');
  return client;
}

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
  } catch (error: unknown) {
    return error instanceof AuthzError ? error.status : undefined;
  }
  return undefined;
}

beforeEach(() => {
  appendEvent.mockReset();
  appendEvent.mockResolvedValue({});
});

describe('requirePermission', () => {
  it('wirft 401 ohne Client', async () => {
    expect(await statusOf(requirePermission(null, PERMISSION_ACTIONS.DELETE_DOSSIER))).toBe(401);
  });

  it('wirft 401 ohne Nutzer und schreibt kein Audit', async () => {
    const client = fakeClient({ user: null, memberships: [] });
    expect(await statusOf(requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER))).toBe(401);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('wirft 401 bei fremder angefragter Kanzlei und schreibt kein Audit', async () => {
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.NOTAR }],
    });
    const result = requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER, {
      requestedOrgId: ORG_B,
    });
    expect(await statusOf(result)).toBe(401);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('liefert den SessionContext für eine berechtigte Rolle', async () => {
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.NOTAR }],
    });
    const ctx = await requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER);
    expect(ctx).toEqual({
      userId: USER_ID,
      organizationId: ORG_A,
      role: NOTARY_ROLES.NOTAR,
      actorLabel: 'Frau Weber',
    });
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('wirft 403 und schreibt genau ein ACCESS_DENIED für eine nicht berechtigte Rolle', async () => {
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.SACHBEARBEITER }],
    });
    const result = requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER, {
      route: 'DELETE /api/documents',
    });
    expect(await statusOf(result)).toBe(403);
    expect(appendEvent).toHaveBeenCalledTimes(1);
    expect(appendEvent).toHaveBeenCalledWith({
      documentId: `access-denied:${ORG_A}`,
      organizationId: ORG_A,
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      actor: 'Frau Weber',
      details: {
        deniedAction: PERMISSION_ACTIONS.DELETE_DOSSIER,
        route: 'DELETE /api/documents',
        actorRole: NOTARY_ROLES.SACHBEARBEITER,
      },
    });
  });

  it('nutzt die Rolle der angefragten Kanzlei bei Mehrfachmitgliedschaft', async () => {
    const client = fakeClient({
      memberships: [
        { organization_id: ORG_A, role: NOTARY_ROLES.NOTAR },
        { organization_id: ORG_B, role: NOTARY_ROLES.SACHBEARBEITER },
      ],
    });
    const result = requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER, {
      requestedOrgId: ORG_B,
    });
    expect(await statusOf(result)).toBe(403);
  });

  it('reicht Datenbankfehler der Mitgliedschaftsabfrage als Error durch', async () => {
    const client = fakeClient({ memberError: { message: 'db down' }, memberships: [] });
    const result = requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER);
    await expect(result).rejects.toThrow('db down');
    expect(await statusOf(requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER))).toBe(
      undefined
    );
  });

  it('reicht Audit-Schreibfehler als Error durch statt 403 zu melden', async () => {
    appendEvent.mockRejectedValue(new Error('audit down'));
    const client = fakeClient({
      memberships: [{ organization_id: ORG_A, role: NOTARY_ROLES.SACHBEARBEITER }],
    });
    const result = requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER);
    await expect(result).rejects.toThrow('audit down');
    expect(await statusOf(requirePermission(client, PERMISSION_ACTIONS.DELETE_DOSSIER))).toBe(
      undefined
    );
  });
});
