import { describe, it, expect } from 'vitest';
import { DB_TABLES, DbTableSchema, TableRow } from './database';

describe('DB_TABLES contract', () => {
  it('validates all canonical table names', () => {
    expect(DbTableSchema.safeParse(DB_TABLES.ORGANIZATIONS).success).toBe(true);
    expect(DbTableSchema.safeParse(DB_TABLES.ORGANIZATION_MEMBERS).success).toBe(true);
    expect(DbTableSchema.safeParse(DB_TABLES.PROFILES).success).toBe(true);
    expect(DbTableSchema.safeParse(DB_TABLES.DOCUMENTS).success).toBe(true);
    expect(DbTableSchema.safeParse(DB_TABLES.DOSSIER_JOBS).success).toBe(true);
    expect(DbTableSchema.safeParse(DB_TABLES.AUDIT_LOGS).success).toBe(true);
    expect(DbTableSchema.safeParse(DB_TABLES.KNOWLEDGE_DOCUMENTS).success).toBe(true);

    expect(DbTableSchema.safeParse('unknown_table').success).toBe(false);
  });

  it('verifies Database schema interface mapping', () => {
    // Type-level assertion
    type OrgRow = TableRow<typeof DB_TABLES.ORGANIZATIONS>;

    const testOrg: OrgRow = {
      id: 'uuid',
      name: 'Test',
      official_seat: 'Köln',
      chamber_district: 'Rheinisch',
      tax_id: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    expect(testOrg.name).toBe('Test');
  });
});
