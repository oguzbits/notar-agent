import { beforeEach, describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS } from '@/types/audit';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES, NotaryRole } from '@/types/organization';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

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

  it('eigene Rolle ändern wird abgelehnt (42501)', async () => {
    const res = await notar.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: NOTARY_ROLES.ADMIN })
      .eq('id', await memberIdOf(notar.id));

    expect(res.error?.code).toBe('42501');
    expect(await notarCount()).toBe(1);
  });

  it('sich selbst entfernen wird abgelehnt (42501)', async () => {
    const res = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .delete()
      .eq('id', await memberIdOf(admin.id));

    expect(res.error?.code).toBe('42501');
  });

  it('letzten Notar herabstufen oder entfernen wird abgelehnt (23514)', async () => {
    const id = await memberIdOf(notar.id);

    const demoted = await admin.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: NOTARY_ROLES.SACHBEARBEITER })
      .eq('id', id);
    const removed = await admin.client.from(DB_TABLES.ORGANIZATION_MEMBERS).delete().eq('id', id);

    expect([demoted.error?.code, removed.error?.code]).toEqual(['23514', '23514']);
    expect(await notarCount()).toBe(1);
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
});
