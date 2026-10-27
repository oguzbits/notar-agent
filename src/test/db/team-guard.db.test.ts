import { beforeEach, describe, expect, it } from 'vitest';
import { TEAM_GUARD_SQLSTATE } from '@/lib/team/team-repository';
import { AUDIT_ACTIONS } from '@/types/audit';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES, NotaryRole } from '@/types/organization';
import { createDbHarness, runPrivilegedSql, type DbHarness, type TestUser } from './db-harness';

/** Schutz der Kanzleibesetzung in der Datenbank (Trigger organization_members_guard). */
describe('Kanzleiteam: Selbständerung und letzter Notar', () => {
  const harness: DbHarness = createDbHarness();
  let orgId: string;
  let notar: TestUser;
  let admin: TestUser;

  const addMember = async (role: NotaryRole) => {
    const user = await harness.createUser();
    const res = await harness.admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .insert({ organization_id: orgId, user_id: user.id, role })
      .select('id')
      .single();
    expect(res.error).toBeNull();
    return { user, memberId: res.data?.id as string };
  };

  const memberIdOf = async (userId: string) => {
    const res = await harness.admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single();
    return res.data?.id as string;
  };

  const notarCount = async () => {
    const res = await harness.admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('id')
      .eq('organization_id', orgId)
      .eq('role', NOTARY_ROLES.NOTAR);
    return (res.data ?? []).length;
  };

  beforeEach(async () => {
    notar = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(notar.id, NOTARY_ROLES.NOTAR);
    admin = (await addMember(NOTARY_ROLES.ADMIN)).user;
  });

  it('eigene Rolle ändern wird abgelehnt', async () => {
    const res = await notar.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: NOTARY_ROLES.ADMIN })
      .eq('id', await memberIdOf(notar.id));

    expect(res.error?.code).toBe(TEAM_GUARD_SQLSTATE.SELF_CHANGE);
    expect(await notarCount()).toBe(1);
  });

  it('sich selbst entfernen wird abgelehnt', async () => {
    const res = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .delete()
      .eq('id', await memberIdOf(admin.id));

    expect(res.error?.code).toBe(TEAM_GUARD_SQLSTATE.SELF_CHANGE);
  });

  it('letzten Notar herabstufen oder entfernen wird abgelehnt', async () => {
    const id = await memberIdOf(notar.id);

    const demoted = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: NOTARY_ROLES.SACHBEARBEITER })
      .eq('id', id);
    const removed = await admin.client.from(DB_TABLES.ORGANIZATION_MEMBERS).delete().eq('id', id);

    expect([demoted.error?.code, removed.error?.code]).toEqual([
      TEAM_GUARD_SQLSTATE.LAST_NOTAR,
      TEAM_GUARD_SQLSTATE.LAST_NOTAR,
    ]);
    expect(await notarCount()).toBe(1);
  });

  it('Mitgliedschaft in eine andere Kanzlei verschieben oder umschreiben ist nicht möglich', async () => {
    const otherNotar = await harness.createUser();
    const otherOrg = await harness.createOrganizationWithMember(otherNotar.id, NOTARY_ROLES.NOTAR);
    // Der ADMIN ist auch in der Zielkanzlei berechtigt, die RLS-Prüfung allein hielte ihn nicht auf
    await harness.admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .insert({ organization_id: otherOrg, user_id: admin.id, role: NOTARY_ROLES.ADMIN });
    const id = await memberIdOf(notar.id);

    const moved = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ organization_id: otherOrg })
      .eq('id', id);
    const rewritten = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ user_id: otherNotar.id })
      .eq('id', id);

    expect([moved.error?.code, rewritten.error?.code]).toEqual(['42501', '42501']);
    expect(await memberIdOf(notar.id)).toBe(id);
    expect(await notarCount()).toBe(1);
  });

  it('Kaskade beim Löschen der Kanzlei bleibt möglich, auch mit angemeldetem Nutzer', () => {
    const claims = JSON.stringify({ sub: notar.id, role: 'authenticated' });
    // Simuliert eine Löschung im Kontext einer Sitzung (z. B. künftige RPC); die Kaskade trifft den letzten NOTAR
    expect(() =>
      runPrivilegedSql(
        `BEGIN; SELECT set_config('request.jwt.claims', '${claims}', true); ` +
          `DELETE FROM organizations WHERE id = '${orgId}'; COMMIT;`
      )
    ).not.toThrow();
  });

  it('einen von zwei Notaren herabstufen ist erlaubt', async () => {
    const second = await addMember(NOTARY_ROLES.NOTAR);

    const res = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: NOTARY_ROLES.NOTARASSESSOR })
      .eq('id', second.memberId);

    expect(res.error).toBeNull();
    expect(await notarCount()).toBe(1);
  });

  it('gleichzeitiges Herabstufen beider Notare lässt immer einen übrig', async () => {
    const ids = [await memberIdOf(notar.id), (await addMember(NOTARY_ROLES.NOTAR)).memberId];
    const setRole = (client: TestUser['client'], id: string, role: NotaryRole) =>
      client.from(DB_TABLES.ORGANIZATION_MEMBERS).update({ role }).eq('id', id);

    // Der Wettlauf tritt ohne Sperre nicht in jedem Durchgang auf, daher mehrere Runden
    const remaining: number[] = [];
    for (let round = 0; round < 8; round++) {
      await harness.admin
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .update({ role: NOTARY_ROLES.NOTAR })
        .in('id', ids);
      await Promise.all(ids.map((id) => setRole(admin.client, id, NOTARY_ROLES.SACHBEARBEITER)));
      remaining.push(await notarCount());
    }

    expect(remaining).toEqual(Array(8).fill(1));
  });

  it('Team-Ereignisse nur in die Kette der eigenen Kanzlei', async () => {
    const foreign = await harness.admin
      .from(DB_TABLES.ORGANIZATIONS)
      .insert({ name: 'Fremd', official_seat: 'Test', chamber_district: 'Test' })
      .select('id')
      .single();
    const entry = (documentId: string) => ({
      organization_id: orgId,
      document_id: documentId,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      actor: 'Notar',
    });

    const own = await notar.client.from(DB_TABLES.AUDIT_LOGS).insert(entry(`team:${orgId}`));
    const other = await notar.client
      .from(DB_TABLES.AUDIT_LOGS)
      .insert(entry(`team:${foreign.data?.id}`));

    expect(own.error).toBeNull();
    expect(other.error?.code).toBe('42501');
  });

  describe('Rolle NOTAR vergibt nur ein NOTAR', () => {
    const insertAs = async (client: TestUser['client'], role: NotaryRole) => {
      const candidate = await harness.createUser();
      return client
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .insert({ organization_id: orgId, user_id: candidate.id, role });
    };

    it('ADMIN legt kein Mitglied als NOTAR an', async () => {
      const res = await insertAs(admin.client, NOTARY_ROLES.NOTAR);
      expect(res.error?.code).toBe('42501');
      expect(await notarCount()).toBe(1);
    });

    it('ADMIN befördert kein Mitglied zum NOTAR', async () => {
      const member = await addMember(NOTARY_ROLES.SACHBEARBEITER);
      const res = await admin.client
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .update({ role: NOTARY_ROLES.NOTAR })
        .eq('id', member.memberId);
      expect(res.error?.code).toBe('42501');
      expect(await notarCount()).toBe(1);
    });

    it('ADMIN legt weiterhin Mitglieder anderer Rollen an', async () => {
      const res = await insertAs(admin.client, NOTARY_ROLES.SACHBEARBEITER);
      expect(res.error).toBeNull();
    });

    it('NOTAR legt ein Mitglied als NOTAR an und befördert', async () => {
      const added = await insertAs(notar.client, NOTARY_ROLES.NOTAR);
      const member = await addMember(NOTARY_ROLES.SACHBEARBEITER);
      const promoted = await notar.client
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .update({ role: NOTARY_ROLES.NOTAR })
        .eq('id', member.memberId);
      expect([added.error, promoted.error]).toEqual([null, null]);
      expect(await notarCount()).toBe(3);
    });

    it('Anlage einer Kanzlei über die Funktion erzeugt weiterhin den ersten NOTAR', async () => {
      const founder = await harness.createUser();
      const res = await founder.client.rpc('create_new_organization', {
        org_name: 'Neu',
        org_seat: 'Test',
        org_chamber: 'Test',
      });
      expect(res.error).toBeNull();
      const members = await harness.admin
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .select('role')
        .eq('user_id', founder.id);
      expect(members.data).toEqual([{ role: NOTARY_ROLES.NOTAR }]);
    });
  });
});
