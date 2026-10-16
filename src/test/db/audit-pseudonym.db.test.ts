import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SupabaseAuditRepository } from '@/lib/audit/audit-repository';
import { DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { AUDIT_ACTIONS } from '@/types/audit';
import { DB_TABLES } from '@/types/database';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

describe('Pseudonyme in der Audit-Kette', () => {
  let harness: DbHarness;
  let owner: TestUser;
  let outsider: TestUser;
  let orgId: string;
  const docA = randomUUID();
  const docB = randomUUID();

  const append = (user: TestUser, documentId: string, actor = 'Dr. Anna Beispiel') =>
    new SupabaseAuditRepository(user.client).appendEvent({
      documentId,
      organizationId: orgId,
      action: AUDIT_ACTIONS.USER_NOTE_MODIFIED,
      actor,
    });

  const rawRows = async (documentId: string) => {
    const res = await harness.admin
      .from(DB_TABLES.AUDIT_LOGS)
      .select('*')
      .eq('document_id', documentId)
      .order('sequence_number');
    expect(res.error).toBeNull();
    return res.data ?? [];
  };

  beforeAll(async () => {
    harness = createDbHarness();
    owner = await harness.createUser();
    outsider = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(owner.id);
    await harness.createOrganizationWithMember(outsider.id);
  });

  it('schreibt ein Pseudonym statt Klarname und Nutzer-ID in die Kette', async () => {
    await append(owner, docA);
    await append(owner, docA);
    const rows = await rawRows(docA);
    expect(rows[0]?.actor).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[0]?.actor).not.toContain('Anna');
    expect(rows[0]?.actor_id).toBeNull();
    expect(rows[1]?.actor).toBe(rows[0]?.actor);
    const check = await owner.client.rpc('verify_audit_chain', { p_document_id: docA });
    expect(check.data).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it('liefert in der Historie den Klarnamen', async () => {
    const history = await new SupabaseAuditRepository(owner.client).getHistory(docA, orgId);
    expect(history.map((e) => e.actor)).toEqual(['Dr. Anna Beispiel', 'Dr. Anna Beispiel']);
  });

  it('zeigt nach Entfall der Zuordnung „Gelöschter Nutzer“ und hält die Kette gültig', async () => {
    await append(owner, docB);
    const del = await harness.admin
      .from(DB_TABLES.AUDIT_ACTOR_MAP)
      .delete()
      .eq('document_id', docB);
    expect(del.error).toBeNull();
    const history = await new SupabaseAuditRepository(owner.client).getHistory(docB, orgId);
    expect(history[0]?.actor).toBe(DELETION_UI_TEXTS_DE.FORMER_USER);
    const check = await owner.client.rpc('verify_audit_chain', { p_document_id: docB });
    expect(check.data).toMatchObject({ valid: true });
  });

  it('lässt Pseudonyme anderer kanzleien nicht lesen und Clients nichts schreiben', async () => {
    const read = await outsider.client
      .from(DB_TABLES.AUDIT_ACTOR_MAP)
      .select('*')
      .eq('document_id', docA);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const own = await owner.client
      .from(DB_TABLES.AUDIT_ACTOR_MAP)
      .select('*')
      .eq('document_id', docA);
    expect(own.data).toHaveLength(1);
    const write = await owner.client
      .from(DB_TABLES.AUDIT_ACTOR_MAP)
      .insert({ document_id: docA, user_id: owner.id, organization_id: orgId, display_name: 'x' });
    expect(write.error).not.toBeNull();
  });
});
