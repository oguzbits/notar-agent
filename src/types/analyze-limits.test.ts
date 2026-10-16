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
