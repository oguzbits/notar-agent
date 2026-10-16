import { describe, it, expect } from 'vitest';
import { evaluateCommand, evaluateFileWrite } from './guards.mjs';

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
