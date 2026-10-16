import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { hasPermission } from '@/lib/auth/rbac';
import { AUDIT_ACTIONS } from '@/types/audit';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { DELETION_REASONS, DELETION_TASK_STATUS, DeletionReceiptSchema } from '@/types/deletion';
import { JOB_STATUS } from '@/types/jobs';
import { NOTARY_ROLES } from '@/types/organization';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

describe('Löschfunktionen und Outbox', () => {
  let harness: DbHarness;
  let orgId: string;
  let owner: TestUser;
  const users = new Map<string, TestUser>();
  const bucket = () => harness.admin.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES);

  const createDossier = async (opts: { files?: string[]; jobStatus?: string } = {}) => {
    const id = randomUUID();
    const doc = await harness.admin
      .from(DB_TABLES.DOCUMENTS)
      .insert({ id, organization_id: orgId, title: 'Löschtest' });
    expect(doc.error).toBeNull();
    const job = await harness.admin.from(DB_TABLES.DOSSIER_JOBS).insert({
      id: randomUUID(),
      organization_id: orgId,
      status: opts.jobStatus ?? JOB_STATUS.COMPLETED,
      payload: { files: (opts.files ?? []).map((storagePath) => ({ storagePath })) },
      result_dossier_id: id,
    });
    expect(job.error).toBeNull();
    return id;
  };

  const exists = async (table: string, column: string, value: string) => {
    const res = await harness.admin.from(table).select(column).eq(column, value);
    expect(res.error).toBeNull();
    return (res.data ?? []).length > 0;
  };

  const tasks = async (documentId: string) => {
    const res = await harness.admin
      .from(DB_TABLES.DELETION_TASKS)
      .select('*')
      .eq('document_id', documentId);
    expect(res.error).toBeNull();
    return res.data ?? [];
  };

  beforeAll(async () => {
    harness = createDbHarness();
    owner = await harness.createUser();
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
    'delete_dossier als %s folgt der Berechtigung DELETE_DOSSIER',
    async (role) => {
      const id = await createDossier();
      await users.get(role)?.client.rpc('delete_dossier', {
        p_document_id: id,
        p_reason: DELETION_REASONS.ENTWURF_VERWORFEN,
      });
      expect(await exists(DB_TABLES.DOCUMENTS, 'id', id)).toBe(
        !hasPermission(role, PERMISSION_ACTIONS.DELETE_DOSSIER)
      );
    }
  );

  it('entfernt alle Daten, legt Aufgaben an und schreibt den Nachweis in die Kette', async () => {
    const jobFile = `${orgId}/${randomUUID()}-vertrag.pdf`;
    const id = await createDossier({ files: [jobFile] });
    const archivePath = `${orgId}/archive/${id}/chunks.json`;
    const uploaded = await bucket().upload(archivePath, new Blob(['x']));
    expect(uploaded.error).toBeNull();
    const instance = await harness.admin.from(DB_TABLES.WORKFLOW_INSTANCES).insert({
      workflow_definition_id: 'wf_def_immobilienkauf_standard',
      case_id: id,
      organization_id: orgId,
    });
    expect(instance.error).toBeNull();
    await owner.client.from(DB_TABLES.AUDIT_LOGS).insert({
      organization_id: orgId,
      document_id: id,
      action: AUDIT_ACTIONS.USER_NOTE_MODIFIED,
      actor: 'Anna',
    });

    const res = await owner.client.rpc('delete_dossier', {
      p_document_id: id,
      p_reason: DELETION_REASONS.FEHLERHAFT_ANGELEGT,
    });
    expect(res.error).toBeNull();
    const receipt = DeletionReceiptSchema.parse(res.data);
    expect(receipt).toMatchObject({ documentId: id, storageTasks: 2 });

    expect(await exists(DB_TABLES.DOCUMENTS, 'id', id)).toBe(false);
    expect(await exists(DB_TABLES.DOSSIER_JOBS, 'result_dossier_id', id)).toBe(false);
    expect(await exists(DB_TABLES.WORKFLOW_INSTANCES, 'case_id', id)).toBe(false);
    expect(await exists(DB_TABLES.AUDIT_ACTOR_MAP, 'document_id', id)).toBe(false);
    expect((await tasks(id)).map((t) => t.storage_path).sort()).toEqual(
      [archivePath, jobFile].sort()
    );

    const chain = await owner.client.rpc('verify_audit_chain', { p_document_id: id });
    expect(chain.data).toMatchObject({ valid: true, totalEntries: 2 });
    const last = await harness.admin
      .from(DB_TABLES.AUDIT_LOGS)
      .select('*')
      .eq('document_id', id)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .single();
    expect(last.data).toMatchObject({ action: AUDIT_ACTIONS.DOSSIER_DELETED });
    expect(last.data?.details).toMatchObject({
      deletion: { reason: DELETION_REASONS.FEHLERHAFT_ANGELEGT, storageTasks: 2 },
    });
  });

  it('übernimmt keinen Pfad einer fremden Kanzlei in die Outbox', async () => {
    const foreign = `${randomUUID()}/${randomUUID()}-fremd.pdf`;
    const id = await createDossier({ files: [foreign] });
    const res = await owner.client.rpc('delete_dossier', {
      p_document_id: id,
      p_reason: DELETION_REASONS.SONSTIGES,
    });
    expect(res.error).toBeNull();
    expect(await tasks(id)).toEqual([]);
  });

  it('lehnt doppeltes Löschen ab und schreibt kein zweites Ereignis', async () => {
    const id = await createDossier();
    const args = { p_document_id: id, p_reason: DELETION_REASONS.SONSTIGES };
    expect((await owner.client.rpc('delete_dossier', args)).error).toBeNull();
    const second = await owner.client.rpc('delete_dossier', args);
    expect(second.error?.code).toBe('P0002');
    const events = await harness.admin
      .from(DB_TABLES.AUDIT_LOGS)
      .select('id')
      .eq('document_id', id)
      .eq('action', AUDIT_ACTIONS.DOSSIER_DELETED);
    expect(events.data).toHaveLength(1);
  });

  it('lehnt unbekannte Gründe ab', async () => {
    const id = await createDossier();
    const res = await owner.client.rpc('delete_dossier', { p_document_id: id, p_reason: 'weil' });
    expect(res.error).not.toBeNull();
    expect(await exists(DB_TABLES.DOCUMENTS, 'id', id)).toBe(true);
  });

  it('blockiert das Löschen bei laufendem Job', async () => {
    const id = await createDossier({ jobStatus: JOB_STATUS.PROCESSING });
    const res = await owner.client.rpc('delete_dossier', {
      p_document_id: id,
      p_reason: DELETION_REASONS.SONSTIGES,
    });
    expect(res.error).not.toBeNull();
    expect(await exists(DB_TABLES.DOCUMENTS, 'id', id)).toBe(true);
  });

  it('wirkt nicht auf Dossiers einer anderen Kanzlei', async () => {
    const id = await createDossier();
    const stranger = await harness.createUser();
    await harness.createOrganizationWithMember(stranger.id, NOTARY_ROLES.NOTAR);
    const res = await stranger.client.rpc('delete_dossier', {
      p_document_id: id,
      p_reason: DELETION_REASONS.SONSTIGES,
    });
    expect(res.error).not.toBeNull();
    expect(await exists(DB_TABLES.DOCUMENTS, 'id', id)).toBe(true);
  });

  it('sperrt Systemfunktionen für angemeldete Nutzer', async () => {
    const id = await createDossier();
    const system = await owner.client.rpc('delete_dossier_system', { p_document_id: id });
    const purge = await owner.client.rpc('complete_dossier_purge', { p_document_id: id });
    expect(system.error).not.toBeNull();
    expect(purge.error).not.toBeNull();
    expect(await exists(DB_TABLES.DOCUMENTS, 'id', id)).toBe(true);
  });

  it('schließt die Löschung erst nach der letzten Aufgabe ab und nur einmal', async () => {
    const file = `${orgId}/${randomUUID()}-a.pdf`;
    const id = await createDossier({ files: [file] });
    await owner.client.rpc('delete_dossier', {
      p_document_id: id,
      p_reason: DELETION_REASONS.SONSTIGES,
    });
    const open = await harness.admin.rpc('complete_dossier_purge', { p_document_id: id });
    expect(open.data).toBe(false);
    const done = await harness.admin
      .from(DB_TABLES.DELETION_TASKS)
      .update({ status: DELETION_TASK_STATUS.DONE })
      .eq('document_id', id);
    expect(done.error).toBeNull();
    expect((await harness.admin.rpc('complete_dossier_purge', { p_document_id: id })).data).toBe(
      true
    );
    expect((await harness.admin.rpc('complete_dossier_purge', { p_document_id: id })).data).toBe(
      false
    );
    const chain = await harness.admin.rpc('verify_audit_chain', { p_document_id: id });
    expect(chain.data).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it('löscht das Pseudonym der Person nicht in anderen Dossiers', async () => {
    const a = await createDossier();
    const b = await createDossier();
    for (const doc of [a, b]) {
      await owner.client.from(DB_TABLES.AUDIT_LOGS).insert({
        organization_id: orgId,
        document_id: doc,
        action: AUDIT_ACTIONS.USER_NOTE_MODIFIED,
        actor: 'Anna',
      });
    }
    const res = await owner.client.rpc('delete_dossier', {
      p_document_id: a,
      p_reason: DELETION_REASONS.SONSTIGES,
    });
    expect(res.error).toBeNull();
    expect(await exists(DB_TABLES.AUDIT_ACTOR_MAP, 'document_id', a)).toBe(false);
    expect(await exists(DB_TABLES.AUDIT_ACTOR_MAP, 'document_id', b)).toBe(true);
  });
});
