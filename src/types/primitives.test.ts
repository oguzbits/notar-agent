import { describe, it, expect } from 'vitest';
import { DbUuidSchema, PG_UUID_REGEX } from './primitives';

describe('primitives', () => {
  it('validates RFC-4122 v4 UUIDs', () => {
    const validV4 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    expect(DbUuidSchema.safeParse(validV4).success).toBe(true);
    expect(PG_UUID_REGEX.test(validV4)).toBe(true);
  });

  it('validates sequential seed UUIDs (e.g. d0000000-0000-0000-0000-000000000001)', () => {
    const seedUuid = 'd0000000-0000-0000-0000-000000000001';
    expect(DbUuidSchema.safeParse(seedUuid).success).toBe(true);
    expect(PG_UUID_REGEX.test(seedUuid)).toBe(true);
  });

  it('rejects invalid UUID formats', () => {
    expect(DbUuidSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(DbUuidSchema.safeParse('12345678-1234-1234-1234-12345678901z').success).toBe(false);
    expect(DbUuidSchema.safeParse('').success).toBe(false);
  });
});
