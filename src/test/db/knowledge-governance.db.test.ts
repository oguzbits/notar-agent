import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_REVIEW_STATUS } from '@/types/knowledge';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

const TERM = 'Zebramuster';
const DAY_MS = 86_400_000;
const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

describe('Governance der Wissensschicht', () => {
  let harness: DbHarness;
  let user: TestUser;
  let orgId: string;
  const titles = {
    current: `aktuell ${randomUUID()}`,
    notYetValid: `noch nicht gültig ${randomUUID()}`,
    expired: `abgelaufen ${randomUUID()}`,
    withdrawn: `zurückgezogen ${randomUUID()}`,
  };

  const row = (title: string, extra: Record<string, unknown>) => ({
    organization_id: orgId,
    category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
    legal_basis: 'Testgrundlage',
    title,
    content: `${TERM} Inhalt`,
    valid_from: null,
    valid_until: null,
    review_status: KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT,
    ...extra,
  });

  beforeAll(async () => {
    harness = createDbHarness();
    user = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(user.id);
    const inserted = await harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).insert([
      row(titles.current, {
        valid_from: isoDay(-30),
        valid_until: isoDay(30),
        review_status: KNOWLEDGE_REVIEW_STATUS.GEPRUEFT,
      }),
      row(titles.notYetValid, { valid_from: isoDay(10) }),
      row(titles.expired, { valid_until: isoDay(-1) }),
      row(titles.withdrawn, { review_status: KNOWLEDGE_REVIEW_STATUS.ZURUECKGEZOGEN }),
    ]);
    expect(inserted.error).toBeNull();
  });

  it('liefert nur gültige, nicht zurückgezogene Einträge', async () => {
    const res = await user.client.rpc('match_knowledge_documents', {
      p_query_text: TERM,
      p_organization_id: orgId,
    });
    expect(res.error).toBeNull();
    expect((res.data ?? []).map((r: { title: string }) => r.title)).toEqual([titles.current]);
  });

  it('gibt Prüfstatus, Gültigkeit und Quelle mit aus', async () => {
    const res = await user.client.rpc('match_knowledge_documents', {
      p_query_text: TERM,
      p_organization_id: orgId,
    });
    expect(res.data?.[0]).toMatchObject({
      review_status: KNOWLEDGE_REVIEW_STATUS.GEPRUEFT,
      version: 1,
    });
  });
});
