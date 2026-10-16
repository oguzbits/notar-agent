import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_REVIEW_STATUS } from '@/types/knowledge';
import { NOTARY_ROLES } from '@/types/organization';
import { createDbHarness, type DbHarness } from './db-harness';

describe('Fristgesteuertes Löschen (list_retention_expired_dossiers)', () => {
  let harness: DbHarness;

  beforeAll(() => {
    harness = createDbHarness();
  });

  const newOrg = async () => {
    const user = await harness.createUser();
    return harness.createOrganizationWithMember(user.id, NOTARY_ROLES.NOTAR);
  };

  const addDossier = async (orgId: string, anchor: Date | null) => {
    const id = randomUUID();
    const res = await harness.admin.from(DB_TABLES.DOCUMENTS).insert({
      id,
      organization_id: orgId,
      title: 'Frist',
      retention_anchor_at: anchor?.toISOString() ?? null,
    });
    expect(res.error).toBeNull();
    return id;
  };

  const addRule = async (
    orgId: string | null,
    years: number,
    reviewStatus: string = KNOWLEDGE_REVIEW_STATUS.GEPRUEFT
  ) => {
    const res = await harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).insert({
      organization_id: orgId,
      category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
      legal_basis: 'Testfrist',
      title: `Frist ${years}`,
      content: 'Aufbewahrungsfrist',
      retention_years: years,
      review_status: reviewStatus,
    });
    expect(res.error).toBeNull();
  };

  const expired = async (orgId: string) => {
    const res = await harness.admin.rpc('list_retention_expired_dossiers', { p_limit: 100 });
    expect(res.error).toBeNull();
    return ((res.data ?? []) as { id: string; organization_id: string }[])
      .filter((r) => r.organization_id === orgId)
      .map((r) => r.id);
  };

  const yearsAgo = (years: number, extraDays = 0) =>
    new Date(Date.now() - (years * 365 + extraDays) * 86_400_000);

  it('liefert nichts ohne Fristdatensatz (fail-closed)', async () => {
    const org = await newOrg();
    await addDossier(org, yearsAgo(50));
    expect(await expired(org)).toEqual([]);
  });

  it('liefert nur Dossiers mit gesetztem Anker und abgelaufener Frist', async () => {
    const org = await newOrg();
    await addRule(org, 2);
    const due = await addDossier(org, yearsAgo(3));
    await addDossier(org, yearsAgo(1));
    await addDossier(org, null);
    expect(await expired(org)).toEqual([due]);
  });

  it('ignoriert ungeprüfte Fristen und nimmt bei mehreren die längste', async () => {
    const org = await newOrg();
    await addRule(org, 1, KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT);
    await addDossier(org, yearsAgo(5));
    expect(await expired(org)).toEqual([]);
    await addRule(org, 3);
    await addRule(org, 10);
    expect(await expired(org)).toEqual([]);
  });

  it('wendet Fristen einer anderen Kanzlei nicht an', async () => {
    const orgA = await newOrg();
    const orgB = await newOrg();
    await addRule(orgA, 1);
    await addDossier(orgB, yearsAgo(5));
    expect(await expired(orgB)).toEqual([]);
  });

  it('ist für angemeldete Nutzer gesperrt', async () => {
    const user = await harness.createUser();
    const res = await user.client.rpc('list_retention_expired_dossiers', { p_limit: 1 });
    expect(res.error).not.toBeNull();
  });
});
