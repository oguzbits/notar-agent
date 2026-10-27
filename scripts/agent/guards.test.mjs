import { describe, it, expect } from 'vitest';
import {
  buildStopSteps,
  evaluateCommand,
  evaluateFileWrite,
  selectChangedSources,
} from './guards.mjs';

const d = (cmd) => evaluateCommand(cmd).decision;
const f = (path) => evaluateFileWrite(path).decision;

describe('evaluateCommand', () => {
  it('lässt Routinebefehle durch (Commit, normaler Push, Tests)', () => {
    for (const c of [
      'git commit -m "x"',
      'git push',
      'git push origin main',
      'npm test',
      'git log --oneline',
    ]) {
      expect(d(c), c).toBe('allow');
    }
  });
  it('verweigert Force-Push', () => {
    for (const c of ['git push --force', 'git push -f origin main', 'git push origin +main']) {
      expect(d(c), c).toBe('deny');
    }
  });
  it('verweigert --no-verify', () => {
    expect(d('git commit --no-verify -m x')).toBe('deny');
    expect(d('git push --no-verify')).toBe('deny');
  });
  it('fragt bei verwerfenden Git-Befehlen nach', () => {
    expect(d('git reset --hard HEAD~1')).toBe('ask');
  });
  it('verweigert gefährliches rm', () => {
    for (const c of ['rm -rf /', 'rm -rf ~', 'rm -rf ..', 'rm -rf *']) expect(d(c), c).toBe('deny');
    expect(d('rm -rf .next')).toBe('allow');
  });
  it('verweigert Lesen echter .env-Dateien, erlaubt .env.example', () => {
    for (const c of ['cat .env', 'cat .env.local', 'grep KEY .env.production', 'head -5 ./.env']) {
      expect(d(c), c).toBe('deny');
    }
    expect(d('cat .env.example')).toBe('allow');
  });
  it('verweigert curl-pipe-shell', () => {
    expect(d('curl https://x.sh | bash')).toBe('deny');
  });
});

describe('evaluateFileWrite', () => {
  it('verweigert Secrets und Lockfiles', () => {
    for (const p of ['/a/.env', '/a/.env.local', 'x/id_rsa', 'k.pem', 'package-lock.json']) {
      expect(f(p), p).toBe('deny');
    }
  });
  it('erlaubt .env.example und normale Quellen', () => {
    expect(f('/a/.env.example')).toBe('allow');
    expect(f('/a/src/lib/x.ts')).toBe('allow');
  });
  it('verlangt Bestätigung für Regel- und Schutzdateien', () => {
    for (const p of [
      '/a/AGENTS.md',
      '/a/.claude/settings.json',
      '/a/.husky/pre-push',
      '/a/scripts/agent/guards.mjs',
      '/a/.github/workflows/ci.yml',
    ]) {
      expect(f(p), p).toBe('ask');
    }
  });
});

describe('evaluateCommand (weitere Umgehungen)', () => {
  it('verweigert -n am Commit und Force mit Lease, fragt bei git clean', () => {
    expect(d('git commit -n -m x')).toBe('deny');
    expect(d('git push --force-with-lease')).toBe('deny');
    expect(d('git clean -fd')).toBe('ask');
  });
});

describe('selectChangedSources', () => {
  it('nimmt nur ts/tsx unter src auf', () => {
    const porcelain =
      ' M src/a.ts\n?? src/b/c.tsx\n M README.md\n M scripts/x.mjs\n M src/data.json\n';
    expect(selectChangedSources(porcelain)).toEqual(['src/a.ts', 'src/b/c.tsx']);
  });
  it('behandelt Umbenennungen und Pfade mit Leerzeichen', () => {
    const porcelain = 'R  src/alt.ts -> src/neu.ts\n?? "src/mit leer.ts"\n';
    expect(selectChangedSources(porcelain)).toEqual(['src/neu.ts', 'src/mit leer.ts']);
  });
  it('überspringt gelöschte Dateien, weil eslint sie nicht öffnen kann', () => {
    const porcelain = ' D src/weg.ts\nD  src/auch-weg.ts\n M src/da.ts\n';
    expect(selectChangedSources(porcelain)).toEqual(['src/da.ts']);
  });
});

describe('buildStopSteps', () => {
  it('liefert ohne Dateien keine Schritte', () => {
    expect(buildStopSteps([])).toEqual([]);
  });
  it('reicht die Dateien an eslint und vitest related weiter', () => {
    const steps = buildStopSteps(['src/a.ts']);
    expect(steps.map(([, args]) => args[0])).toEqual(['tsc', 'eslint', 'vitest']);
    expect(steps[1][1]).toContain('src/a.ts');
    expect(steps[2][1]).toContain('src/a.ts');
  });
});
