import { describe, expect, it, vi } from 'vitest';
import { UPLOAD_URL_RATE_LIMIT } from '@/types/storage';
import { countRecentUploads } from './upload-quota';

const org = '550e8400-e29b-41d4-a716-446655440000';

describe('countRecentUploads', () => {
  it('zählt in PostgreSQL über count_recent_uploads mit Kanzlei und Zeitfenster', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 7, error: null });

    const count = await countRecentUploads({ rpc } as never, org);

    expect(count).toBe(7);
    expect(rpc).toHaveBeenCalledWith('count_recent_uploads', {
      p_organization_id: org,
      p_window: `${UPLOAD_URL_RATE_LIMIT.WINDOW_SECONDS} seconds`,
    });
  });

  it('wirft bei Datenbankfehler (kein stilles Weiterlaufen ohne Zählung)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'kaputt' } });

    await expect(countRecentUploads({ rpc } as never, org)).rejects.toThrow(
      /countRecentUploads fehlgeschlagen: kaputt/
    );
  });
});
