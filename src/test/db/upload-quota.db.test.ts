import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { countRecentUploads } from '@/lib/storage/upload-quota';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

/** Rate-Grenze für Upload-URLs: count_recent_uploads zählt je Kanzlei und nur im Zeitfenster. */
describe('Zählung der Uploads je Kanzlei', () => {
  let harness: DbHarness;
  let mitglied: TestUser;
  let fremder: TestUser;
  let orgId: string;
  let fremdeOrgId: string;

  const upload = (organizationId: string) =>
    harness.admin.storage
      .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
      .upload(`${organizationId}/${randomUUID()}-scan.png`, new Blob(['x']), {
        contentType: 'image/png',
      });

  beforeAll(async () => {
    harness = createDbHarness();
    mitglied = await harness.createUser();
    fremder = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(mitglied.id);
    fremdeOrgId = await harness.createOrganizationWithMember(fremder.id);
    for (let i = 0; i < 3; i++) expect((await upload(orgId)).error).toBeNull();
    expect((await upload(fremdeOrgId)).error).toBeNull();
  });

  it('zählt die Uploads der eigenen Kanzlei im Fenster', async () => {
    expect(await countRecentUploads(mitglied.client, orgId)).toBe(3);
  });

  it('zählt für eine fremde Kanzlei nichts (Select-Policy des Buckets)', async () => {
    expect(await countRecentUploads(mitglied.client, fremdeOrgId)).toBe(0);
  });

  it('zählt keine Uploads außerhalb des Fensters', async () => {
    const { data, error } = await mitglied.client.rpc('count_recent_uploads', {
      p_organization_id: orgId,
      p_window: '0 seconds',
    });
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it('ist ohne Sitzung (Rolle anon) nicht aufrufbar', async () => {
    const { error } = await harness
      .createAnonymousClient()
      .rpc('count_recent_uploads', { p_organization_id: orgId, p_window: '1 hour' });
    expect(error).not.toBeNull();
  });
});
