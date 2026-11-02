import { describe, expect, it } from 'vitest';
import { findDrift, isWaived, parseCovers } from './docs-drift.mjs';

const doc = { path: 'docs/architecture/job-orchestration.md', covers: ['src/lib/jobs/'] };

describe('parseCovers', () => {
  it('liest die Pfadpräfixe aus dem Frontmatter', () => {
    const text = '---\ncovers:\n  - src/lib/jobs/\n  - src/app/api/jobs/\n---\n# Titel\n';
    expect(parseCovers(text)).toEqual(['src/lib/jobs/', 'src/app/api/jobs/']);
  });

  it('liefert eine leere Liste ohne Frontmatter', () => {
    expect(parseCovers('# Titel\n\ncovers:\n  - src/x/\n')).toEqual([]);
  });
});

describe('findDrift', () => {
  it('meldet ein geändertes Quellfile, wenn die Doku unberührt bleibt', () => {
    const drift = findDrift({
      changed: ['src/lib/jobs/job-worker.ts'],
      docs: [doc],
      waived: false,
    });
    expect(drift).toEqual([{ doc: doc.path, files: ['src/lib/jobs/job-worker.ts'] }]);
  });

  it('meldet nichts, wenn die Doku im selben Bereich mitgeändert wurde', () => {
    const changed = ['src/lib/jobs/job-worker.ts', doc.path];
    expect(findDrift({ changed, docs: [doc], waived: false })).toEqual([]);
  });

  it('ignoriert Testdateien', () => {
    const changed = ['src/lib/jobs/job-worker.test.ts'];
    expect(findDrift({ changed, docs: [doc], waived: false })).toEqual([]);
  });

  it('ignoriert Dateien außerhalb der Präfixe', () => {
    expect(findDrift({ changed: ['src/lib/team/x.ts'], docs: [doc], waived: false })).toEqual([]);
  });

  it('meldet nichts, wenn die Prüfung ausdrücklich freigestellt ist', () => {
    const drift = findDrift({ changed: ['src/lib/jobs/job-worker.ts'], docs: [doc], waived: true });
    expect(drift).toEqual([]);
  });
});

describe('isWaived', () => {
  it('erkennt die Zeile "Docs: unverändert" in Commit-Texten', () => {
    expect(isWaived('fix(jobs): x\n\nDocs: unverändert\n')).toBe(true);
  });

  it('erkennt sie nicht als Teil eines anderen Satzes', () => {
    expect(isWaived('Die Docs: unverändert lassen wir nicht')).toBe(false);
  });
});
