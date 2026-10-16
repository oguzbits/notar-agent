import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { createDbHarness, runPrivilegedSql, type DbHarness, type TestUser } from './db-harness';

const GENESIS = '0'.repeat(64);

describe('Audit-Kette in der Datenbank', () => {
  let harness: DbHarness;
  let owner: TestUser;
  let orgId: string;
  const docId = randomUUID();

  // Der Client liefert absichtlich gefälschte Kettenfelder; die Datenbank muss sie überschreiben.
  const forged = (document: string) => ({
    organization_id: orgId,
    document_id: document,
    sequence_number: 99,
    action: 'TEST',
    actor: 'tester',
    actor_id: randomUUID(),
    previous_hash: 'a'.repeat(64),
    current_hash: 'b'.repeat(64),
    details: { note: 'x' },
  });

  const rows = async (document: string) => {
    const res = await harness.admin
      .from(DB_TABLES.AUDIT_LOGS)
      .select('*')
      .eq('document_id', document)
      .order('sequence_number');
    expect(res.error).toBeNull();
    return res.data ?? [];
  };

  beforeAll(async () => {
    harness = createDbHarness();
    owner = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(owner.id);
  });

  it('vergibt Sequenz, Vorgänger-Hash, Hash und Akteur-ID serverseitig', async () => {
    const res = await owner.client.from(DB_TABLES.AUDIT_LOGS).insert(forged(docId));
    expect(res.error).toBeNull();

    const [first] = await rows(docId);
    expect(first).toMatchObject({ sequence_number: 0, previous_hash: GENESIS, actor_id: owner.id });
    expect(first?.current_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first?.current_hash).not.toBe('b'.repeat(64));
  });

  it('verkettet den Folgeeintrag mit dem Hash des Vorgängers', async () => {
    await owner.client.from(DB_TABLES.AUDIT_LOGS).insert(forged(docId));

    const [first, second] = await rows(docId);
    expect(second).toMatchObject({ sequence_number: 1, previous_hash: first?.current_hash });
  });

  it('vergibt bei parallelen Einträgen lückenlose Sequenzen', async () => {
    const parallelDoc = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        owner.client.from(DB_TABLES.AUDIT_LOGS).insert(forged(parallelDoc))
      )
    );
    expect(results.map((r) => r.error)).toEqual(Array(8).fill(null));
    expect((await rows(parallelDoc)).map((r) => r.sequence_number)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('lässt weder Ändern noch Löschen zu, auch nicht dem Servicekonto', async () => {
    const update = await harness.admin
      .from(DB_TABLES.AUDIT_LOGS)
      .update({ actor: 'manipuliert' })
      .eq('document_id', docId);
    const remove = await harness.admin.from(DB_TABLES.AUDIT_LOGS).delete().eq('document_id', docId);
    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect((await rows(docId)).every((r) => r.actor === 'tester')).toBe(true);
  });

  it('bestätigt eine unversehrte Kette', async () => {
    const res = await owner.client.rpc('verify_audit_chain', { p_document_id: docId });
    expect(res.data).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it('erkennt eine nachträglich veränderte Zeile', async () => {
    const tamperedDoc = randomUUID();
    await owner.client.from(DB_TABLES.AUDIT_LOGS).insert(forged(tamperedDoc));
    await owner.client.from(DB_TABLES.AUDIT_LOGS).insert(forged(tamperedDoc));

    runPrivilegedSql(
      `ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable; UPDATE audit_logs SET actor = 'manipuliert' WHERE document_id = '${tamperedDoc}' AND sequence_number = 0; ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable;`
    );

    const res = await owner.client.rpc('verify_audit_chain', { p_document_id: tamperedDoc });
    expect(res.data).toMatchObject({ valid: false, brokenSequenceIndex: 0 });
  });
});
