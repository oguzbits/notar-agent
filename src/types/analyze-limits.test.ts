import { describe, it, expect } from 'vitest';
import { ANALYZE_LIMITS, AnalyzeRequestSchema } from './dossier';

const file = { name: 'a.pdf', type: 'application/pdf', size: 10 };

describe('AnalyzeRequestSchema Obergrenzen', () => {
  it('lehnt zu viele Dateien ab', () => {
    const files = Array.from({ length: ANALYZE_LIMITS.MAX_FILES + 1 }, () => file);
    expect(AnalyzeRequestSchema.safeParse({ files }).success).toBe(false);
  });
  it('lehnt zu große Dateien ab', () => {
    const files = [{ ...file, size: ANALYZE_LIMITS.MAX_FILE_BYTES + 1 }];
    expect(AnalyzeRequestSchema.safeParse({ files }).success).toBe(false);
  });
  it('lehnt zu lange Notizen ab', () => {
    const notes = 'x'.repeat(ANALYZE_LIMITS.MAX_NOTES_CHARS + 1);
    expect(AnalyzeRequestSchema.safeParse({ notes }).success).toBe(false);
  });
  it('akzeptiert Werte innerhalb der Grenzen', () => {
    expect(AnalyzeRequestSchema.safeParse({ files: [file] }).success).toBe(true);
  });
});

describe('storagePath in Dateien', () => {
  const org = 'a0000000-0000-4000-8000-000000000001';
  const parse = (storagePath: string) =>
    AnalyzeRequestSchema.safeParse({ files: [{ ...file, storagePath }] }).success;
  it('akzeptiert <uuid>/<Datei>', () => {
    expect(parse(`${org}/11111111-vertrag.pdf`)).toBe(true);
  });
  it.each([
    `${org}/archive/akte/snapshot.json`,
    `${org}/../b0000000-0000-4000-8000-000000000002/x.pdf`,
    `${org}/..x.pdf`,
    `${org}/`,
    'org-1/datei.pdf',
    '../x',
  ])('lehnt %s ab', (path) => {
    expect(parse(path)).toBe(false);
  });
});
