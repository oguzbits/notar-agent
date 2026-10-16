import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { JOB_STATUS } from '@/types/jobs';
import { KNOWLEDGE_CATEGORIES } from '@/types/knowledge';
import { NOTARY_ROLES } from '@/types/organization';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import { createDbHarness, TestUser } from './db-harness';

const harness = createDbHarness();
const { admin, anon } = harness;

let owner: TestUser;
let outsider: TestUser;
let clerk: TestUser;
let orgId: string;
let docId: string;
let jobId: string;
const filePath = () => `${orgId}/${jobId}/vertrag.pdf`;

beforeAll(async () => {
  owner = await harness.createUser();
  outsider = await harness.createUser();
  clerk = await harness.createUser();
  orgId = await harness.createOrganizationWithMember(owner.id, NOTARY_ROLES.NOTAR);
  await harness.createOrganizationWithMember(outsider.id, NOTARY_ROLES.NOTAR);
  await admin
    .from(DB_TABLES.ORGANIZATION_MEMBERS)
    .insert({ organization_id: orgId, user_id: clerk.id, role: NOTARY_ROLES.SACHBEARBEITER });

  docId = randomUUID();
  jobId = randomUUID();
  await admin
    .from(DB_TABLES.DOCUMENTS)
    .insert({ id: docId, organization_id: orgId, title: 'Geheim' });
  await admin.from(DB_TABLES.DOSSIER_JOBS).insert({
    id: jobId,
    organization_id: orgId,
    status: JOB_STATUS.PENDING,
    payload: { files: [{ storagePath: filePath() }] },
  });
  const upload = await admin.storage
    .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
    .upload(filePath(), new Blob(['geheimer Inhalt']), { upsert: true });
  expect(upload.error).toBeNull();
  await admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).delete().in('title', ['privat', 'global']);
  await admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).insert([
    {
      organization_id: orgId,
      category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
      legal_basis: 'x',
      title: 'privat',
      content: 'Kanzleigeheimnis Quokka',
    },
    {
      organization_id: null,
      category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
      legal_basis: 'x',
      title: 'global',
      content: 'Allgemein Quokka',
    },
  ]);
});

describe('Lesen fremder Kanzleidaten', () => {
  it.each([
    DB_TABLES.DOCUMENTS,
    DB_TABLES.DOSSIER_JOBS,
    DB_TABLES.ORGANIZATION_MEMBERS,
    DB_TABLES.ORGANIZATIONS,
  ])('Fremder Nutzer sieht keine Zeilen aus %s', async (table) => {
    const res = await outsider.client
      .from(table)
      .select('*')
      .or(`id.eq.${orgId},organization_id.eq.${orgId}`);
    expect(res.data ?? []).toEqual([]);
  });

  it('Mitglied sieht die eigenen Dokumente', async () => {
    const res = await owner.client.from(DB_TABLES.DOCUMENTS).select('id').eq('id', docId);
    expect(res.data).toHaveLength(1);
  });
});

describe('Schreiben in fremde Kanzleien', () => {
  it('Fremder Nutzer kann kein Dokument einfügen', async () => {
    const res = await outsider.client
      .from(DB_TABLES.DOCUMENTS)
      .insert({ id: randomUUID(), organization_id: orgId, title: 'x' });
    expect(res.error).not.toBeNull();
  });

  it('Fremder Nutzer kann keinen Audit-Eintrag einfügen', async () => {
    const res = await outsider.client
      .from(DB_TABLES.AUDIT_LOGS)
      .insert({ organization_id: orgId, document_id: docId, actor_id: outsider.id, action: 'X' });
    expect(res.error).not.toBeNull();
  });
});

describe('Beitritt zu Kanzleien (SEC-01)', () => {
  it('Nutzer ohne Mitgliedschaft kann sich nicht als NOTAR in eine fremde Kanzlei eintragen', async () => {
    const newcomer = await harness.createUser();
    const res = await newcomer.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .insert({ organization_id: orgId, user_id: newcomer.id, role: NOTARY_ROLES.NOTAR });
    expect(res.error).not.toBeNull();
    const check = await admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', newcomer.id);
    expect(check.data).toEqual([]);
  });

  it('Mitglied einer anderen Kanzlei kann sich nicht in eine fremde Kanzlei eintragen', async () => {
    const res = await outsider.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .insert({ organization_id: orgId, user_id: outsider.id, role: NOTARY_ROLES.NOTAR });
    expect(res.error).not.toBeNull();
  });

  it('Nutzer kann sich nicht selbst in eine leere Kanzlei eintragen', async () => {
    const empty = await admin
      .from(DB_TABLES.ORGANIZATIONS)
      .insert({ name: 'Leer', official_seat: 'x', chamber_district: 'x' })
      .select('id')
      .single();
    const newcomer = await harness.createUser();
    const res = await newcomer.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .insert({ organization_id: empty.data?.id, user_id: newcomer.id, role: NOTARY_ROLES.NOTAR });
    expect(res.error).not.toBeNull();
  });

  it('Sachbearbeiter kann die eigene Rolle nicht anheben', async () => {
    await clerk.client
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: NOTARY_ROLES.NOTAR })
      .eq('user_id', clerk.id);
    const check = await admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('role')
      .eq('user_id', clerk.id)
      .single();
    expect(check.data?.role).toBe(NOTARY_ROLES.SACHBEARBEITER);
  });

  it('Nutzer kann Kanzleien nicht direkt anlegen', async () => {
    const res = await outsider.client
      .from(DB_TABLES.ORGANIZATIONS)
      .insert({ name: 'Direkt', official_seat: 'x', chamber_district: 'x' });
    expect(res.error).not.toBeNull();
  });

  it('create_new_organization legt Kanzlei samt NOTAR-Mitgliedschaft für den Aufrufer an', async () => {
    const fresh = await harness.createUser();
    const res = await fresh.client.rpc('create_new_organization', {
      org_name: 'Neu',
      org_seat: 'Köln',
      org_chamber: 'Rheinische Notarkammer',
    });
    expect(res.error).toBeNull();
    const member = await admin
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('role')
      .eq('user_id', fresh.id)
      .single();
    expect(member.data?.role).toBe(NOTARY_ROLES.NOTAR);
  });

  it('create_new_organization ist ohne Anmeldung nicht aufrufbar', async () => {
    const res = await anon.rpc('create_new_organization', {
      org_name: 'X',
      org_seat: 'x',
      org_chamber: 'x',
    });
    expect(res.error).not.toBeNull();
  });
});

describe('Dateizugriff (SEC-02)', () => {
  it('Ohne Anmeldung ist die Datei eines Jobs nicht lesbar', async () => {
    const res = await anon.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES).download(filePath());
    expect(res.error).not.toBeNull();
  });

  it('Fremder Nutzer kann die Datei nicht lesen', async () => {
    const res = await outsider.client.storage
      .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
      .download(filePath());
    expect(res.error).not.toBeNull();
  });

  it('Mitglied kann die eigene Datei lesen', async () => {
    const res = await owner.client.storage
      .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
      .download(filePath());
    expect(res.error).toBeNull();
  });
});

describe('Wissenssuche (SEC-03)', () => {
  const search = (user: TestUser, org: string) =>
    user.client.rpc('match_knowledge_documents', {
      p_query_text: 'Quokka',
      p_organization_id: org,
    });

  it('Fremder Nutzer erhält mit fremder Organisations-ID kein Kanzleiwissen', async () => {
    const res = await search(outsider, orgId);
    expect(res.error).toBeNull();
    expect((res.data ?? []).map((r: { title: string }) => r.title)).toEqual(['global']);
  });

  it('Mitglied erhält Kanzleiwissen und globales Wissen', async () => {
    const res = await search(owner, orgId);
    expect((res.data ?? []).map((r: { title: string }) => r.title).sort()).toEqual([
      'global',
      'privat',
    ]);
  });
});
