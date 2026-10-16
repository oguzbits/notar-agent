import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { hasPermission } from '@/lib/auth/rbac';
import { AUDIT_ACTIONS } from '@/types/audit';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { DELETION_REASONS } from '@/types/deletion';
import { JOB_STATUS } from '@/types/jobs';
import { NOTARY_ROLES } from '@/types/organization';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

describe('Rollenprüfung in der Datenbank', () => {
  let harness: DbHarness;
  let orgId: string;
  const users = new Map<string, TestUser>();

  const documentExists = async (id: string) => {
    const res = await harness.admin.from(DB_TABLES.DOCUMENTS).select('id').eq('id', id);
    expect(res.error).toBeNull();
    return (res.data ?? []).length === 1;
  };

  beforeAll(async () => {
    harness = createDbHarness();
    const owner = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(owner.id, NOTARY_ROLES.NOTAR);
    users.set(NOTARY_ROLES.NOTAR, owner);
    for (const role of Object.values(NOTARY_ROLES).filter((r) => r !== NOTARY_ROLES.NOTAR)) {
      const user = await harness.createUser();
      const member = await harness.admin
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .insert({ organization_id: orgId, user_id: user.id, role });
      expect(member.error).toBeNull();
      users.set(role, user);
    }
  });

  it.each(Object.values(NOTARY_ROLES))(
    'Dossier löschen als %s folgt der Berechtigung DELETE_DOSSIER',
    async (role) => {
      const docId = randomUUID();
      await harness.admin
        .from(DB_TABLES.DOCUMENTS)
        .insert({ id: docId, organization_id: orgId, title: 'Rollen-Test' });

      await users.get(role)?.client.rpc('delete_dossier', {
        p_document_id: docId,
        p_reason: DELETION_REASONS.SONSTIGES,
      });

      expect(await documentExists(docId)).toBe(
        !hasPermission(role, PERMISSION_ACTIONS.DELETE_DOSSIER)
      );
    }
  );

  it('Sachbearbeiter darf Dossiers weiterhin lesen und ändern', async () => {
    const docId = randomUUID();
    await harness.admin
      .from(DB_TABLES.DOCUMENTS)
      .insert({ id: docId, organization_id: orgId, title: 'Vorher' });
    const clerk = users.get(NOTARY_ROLES.SACHBEARBEITER)?.client;

    const update = await clerk
      ?.from(DB_TABLES.DOCUMENTS)
      .update({ title: 'Nachher' })
      .eq('id', docId);
    const read = await clerk?.from(DB_TABLES.DOCUMENTS).select('title').eq('id', docId).single();

    expect(update?.error).toBeNull();
    expect(read?.data?.title).toBe('Nachher');
  });

  it('ACCESS_DENIED eines Sachbearbeiters verkettet lückenlos', async () => {
    const clerk = users.get(NOTARY_ROLES.SACHBEARBEITER);
    const docId = `access-denied:${orgId}`;
    const entry = {
      organization_id: orgId,
      document_id: docId,
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      actor: 'Sachbearbeiter',
      details: { deniedAction: PERMISSION_ACTIONS.DELETE_DOSSIER },
    };

    const first = await clerk?.client.from(DB_TABLES.AUDIT_LOGS).insert(entry);
    const second = await clerk?.client.from(DB_TABLES.AUDIT_LOGS).insert(entry);
    const chain = await clerk?.client.rpc('verify_audit_chain', { p_document_id: docId });

    expect([first?.error, second?.error]).toEqual([null, null]);
    expect(chain?.data).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it.each(Object.values(NOTARY_ROLES))(
    'Job löschen als %s folgt der Berechtigung DELETE_DOSSIER',
    async (role) => {
      const jobId = randomUUID();
      const inserted = await harness.admin
        .from(DB_TABLES.DOSSIER_JOBS)
        .insert({ id: jobId, organization_id: orgId, status: JOB_STATUS.PENDING, payload: {} });
      expect(inserted.error).toBeNull();

      await users.get(role)?.client.from(DB_TABLES.DOSSIER_JOBS).delete().eq('id', jobId);

      const left = await harness.admin.from(DB_TABLES.DOSSIER_JOBS).select('id').eq('id', jobId);
      expect((left.data ?? []).length === 1).toBe(
        !hasPermission(role, PERMISSION_ACTIONS.DELETE_DOSSIER)
      );
    }
  );

  it.each([NOTARY_ROLES.SACHBEARBEITER, NOTARY_ROLES.NOTAR])(
    'Originaldatei im Speicher löschen als %s folgt der Berechtigung DELETE_DOSSIER',
    async (role) => {
      const path = `${orgId}/${randomUUID()}/vertrag.pdf`;
      const bucket = harness.admin.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
      const uploaded = await bucket.upload(path, new Blob(['x']), {
        contentType: 'application/pdf',
      });
      expect(uploaded.error).toBeNull();

      await users.get(role)?.client.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES).remove([path]);

      const folder = path.split('/').slice(0, 2).join('/');
      const listed = await bucket.list(folder);
      expect((listed.data ?? []).length === 1).toBe(
        !hasPermission(role, PERMISSION_ACTIONS.DELETE_DOSSIER)
      );
    }
  );

  it('Verweigerungs-Ereignis darf nicht in die Kette einer fremden Kanzlei geschrieben werden', async () => {
    const stranger = await harness.createUser();
    const otherOrg = await harness.createOrganizationWithMember(stranger.id, NOTARY_ROLES.NOTAR);
    const clerk = users.get(NOTARY_ROLES.SACHBEARBEITER);

    const forged = await clerk?.client.from(DB_TABLES.AUDIT_LOGS).insert({
      organization_id: orgId,
      document_id: `access-denied:${otherOrg}`,
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      actor: 'Fremd',
      details: {},
    });

    expect(forged?.error).not.toBeNull();
  });
});
