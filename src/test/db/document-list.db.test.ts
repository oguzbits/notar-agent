import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_LIST_LIMIT, SupabaseDossierRepository } from '@/lib/supabase/repository';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';
import { createDbHarness } from './db-harness';

const harness = createDbHarness();

describe('Dokumentliste (list)', () => {
  it('begrenzt die Anzahl auf DOCUMENT_LIST_LIMIT, neueste zuerst', async () => {
    const owner = await harness.createUser();
    const orgId = await harness.createOrganizationWithMember(owner.id, NOTARY_ROLES.NOTAR);
    const rows = Array.from({ length: DOCUMENT_LIST_LIMIT + 1 }, (_, i) => ({
      id: randomUUID(),
      organization_id: orgId,
      title: `Vorgang ${i}`,
      created_at: new Date(Date.now() - (DOCUMENT_LIST_LIMIT - i) * 1000).toISOString(),
    }));
    const { error } = await harness.admin.from(DB_TABLES.DOCUMENTS).insert(rows);
    expect(error).toBeNull();

    const listed = await new SupabaseDossierRepository(owner.client).list(orgId);

    expect(listed).toHaveLength(DOCUMENT_LIST_LIMIT);
    expect(listed[0]?.title).toBe(`Vorgang ${DOCUMENT_LIST_LIMIT}`);
  });
});
