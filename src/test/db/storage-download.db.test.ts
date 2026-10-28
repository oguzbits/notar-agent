import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveFileBuffer } from '@/lib/storage/storage-service';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import { createDbHarness, type DbHarness, type TestUser } from './db-harness';

describe('Download der Originaldateien (Storage-RLS)', () => {
  let harness: DbHarness;
  let mitglied: TestUser;
  let fremder: TestUser;
  let path: string;

  beforeAll(async () => {
    harness = createDbHarness();
    mitglied = await harness.createUser();
    fremder = await harness.createUser();
    const orgId = await harness.createOrganizationWithMember(mitglied.id);
    await harness.createOrganizationWithMember(fremder.id);
    path = `${orgId}/${randomUUID()}-Personalausweis_Scan.png`;
    const up = await harness.admin.storage
      .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
      .upload(path, new Blob(['bytes']), { contentType: 'image/png' });
    expect(up.error).toBeNull();
  });

  const file = () => ({ name: 'Personalausweis_Scan.png', storagePath: path });

  it('lädt mit dem Sitzungs-Client eines Kanzleimitglieds', async () => {
    const buffer = await resolveFileBuffer(file(), mitglied.client);
    expect(buffer.toString()).toBe('bytes');
  });

  it('lädt nicht mit einem Client ohne Sitzung (Rolle anon)', async () => {
    await expect(resolveFileBuffer(file(), harness.createAnonymousClient())).rejects.toThrow(
      /Storage Download fehlgeschlagen/
    );
  });

  it('lädt nicht mit dem Client einer fremden Kanzlei', async () => {
    await expect(resolveFileBuffer(file(), fremder.client)).rejects.toThrow(
      /Storage Download fehlgeschlagen/
    );
  });
});
