import { beforeAll, describe, expect, it } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import { createDbHarness, type TestUser } from './db-harness';

describe('Profile von Kanzleikollegen (RLS)', () => {
  let notar: TestUser;
  let kollege: TestUser;
  let fremder: TestUser;

  beforeAll(async () => {
    const harness = createDbHarness();
    notar = await harness.createUser();
    kollege = await harness.createUser();
    fremder = await harness.createUser();
    const orgId = await harness.createOrganizationWithMember(notar.id, NOTARY_ROLES.NOTAR);
    const member = await harness.admin.from(DB_TABLES.ORGANIZATION_MEMBERS).insert({
      organization_id: orgId,
      user_id: kollege.id,
      role: NOTARY_ROLES.SACHBEARBEITER,
    });
    expect(member.error).toBeNull();
    await harness.createOrganizationWithMember(fremder.id, NOTARY_ROLES.NOTAR);
  });

  const readableProfiles = async (reader: TestUser, ids: string[]) => {
    const res = await reader.client.from(DB_TABLES.PROFILES).select('id').in('id', ids);
    expect(res.error).toBeNull();
    return (res.data ?? []).map((p) => p.id);
  };

  it('Kollege derselben Kanzlei ist lesbar', async () => {
    expect(await readableProfiles(notar, [kollege.id])).toEqual([kollege.id]);
  });

  it('Eigenes Profil bleibt lesbar', async () => {
    expect(await readableProfiles(kollege, [kollege.id])).toEqual([kollege.id]);
  });

  it('Mitglied einer fremden Kanzlei ist nicht lesbar', async () => {
    expect(await readableProfiles(notar, [fremder.id])).toEqual([]);
    expect(await readableProfiles(fremder, [notar.id, kollege.id])).toEqual([]);
  });
});
