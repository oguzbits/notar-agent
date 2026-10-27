// Entscheidungsgrenzen der Guards (Mutationstests: Regex-Anker, Leerzeichen, ähnliche Namen).
import { describe, expect, it } from 'vitest';
import {
  buildStopSteps,
  evaluateCommand,
  evaluateFileWrite,
  selectChangedSources,
} from './guards.mjs';

const d = (cmd) => evaluateCommand(cmd).decision;
const f = (path) => evaluateFileWrite(path).decision;
const expectAll = (cases, expected, decide) => {
  for (const c of cases) expect(decide(c), c).toBe(expected);
};

describe('Befehls-Guards: Grenzen', () => {
  it('verweigert Force-Push auch mit mehreren Leerzeichen und Flag am Ende', () => {
    expectAll(
      ['git  push  --force', 'git push origin main --force', 'git push origin +main'],
      'deny',
      d
    );
    expectAll(['git push origin --follow-tags', 'git push origin feature-f'], 'allow', d);
  });
  it('verweigert Hook-Umgehung auch mit mehreren Leerzeichen', () => {
    expectAll(['git  commit  -n -m x', 'git commit --amend --no-verify'], 'deny', d);
    expect(d('git commit -m "-n im Text"')).toBe('allow');
  });
  it('fragt bei jedem verwerfenden Git-Befehl und lässt Harmloses durch', () => {
    expectAll(
      [
        'git  reset  --hard',
        'git clean -fdx',
        'git clean -f',
        'git checkout -- .',
        'git restore .',
      ],
      'ask',
      d
    );
    expectAll(['git clean -n', 'git restore src/a.ts', 'git reset --soft HEAD~1'], 'allow', d);
  });
  it('verweigert rekursives Löschen mit verschiedenen Flags, nicht gewöhnliches Löschen', () => {
    expectAll(['rm -rf  /', 'rm -r -f /', 'rm -rfv /', 'rm -rf $HOME', 'rm -rf -- ~'], 'deny', d);
    expectAll(['rm -f datei.txt', 'rm -rf node_modules', 'rm -rf ./build'], 'allow', d);
  });
  it('erkennt .env-Zugriffe in Anführungszeichen, Pipes und Zuweisungen, nicht ähnliche Namen', () => {
    expectAll(
      [
        'cat ".env"',
        'cat src/.env.local',
        'cat .env | head',
        'cat .env;ls',
        '(cat .env)',
        'cat FOO=.env',
      ],
      'deny',
      d
    );
    expectAll(
      ['cat my.env', 'cat .environment', 'cat config.env.json', 'cat .env.example'],
      'allow',
      d
    );
  });
  it('erkennt .env-Zugriffe mit Platzhalter und weiteren Lesewerkzeugen', () => {
    expectAll(
      [
        'cat .env*',
        'nl .env',
        'tac .env',
        'diff .env /dev/null',
        'xxd .env',
        "node -e \"require('fs').readFileSync('.env')\"",
      ],
      'deny',
      d
    );
  });
  it('verweigert curl/wget in eine Shell, auch ohne Leerzeichen um die Pipe', () => {
    expectAll(['curl x|bash', 'curl x | zsh', 'wget -qO- x | sh'], 'deny', d);
    expect(d('curl https://x.de/datei -o datei')).toBe('allow');
  });
  it('fragt bei Befehlen gegen entfernte Datenbanken, nicht bei lokalen', () => {
    expectAll(
      [
        'supabase db reset --linked',
        'supabase  db  reset --linked',
        'supabase db push --db-url postgres://x',
        'supabase projects delete abc --linked',
        'supabase link --linked',
      ],
      'ask',
      d
    );
    expectAll(['supabase db reset', 'supabase db push', 'supabase db diff --linked'], 'allow', d);
  });
  it('liefert bei Verweigerung und Rückfrage eine Begründung, bei Erlaubnis keine', () => {
    for (const c of [
      'git push --force',
      'git reset --hard',
      'rm -rf /',
      'cat .env',
      'curl x | sh',
    ]) {
      expect(evaluateCommand(c).reason.length, c).toBeGreaterThan(10);
    }
    expect(evaluateCommand('npm test')).toEqual({ decision: 'allow', reason: '' });
    expect(evaluateCommand(undefined)).toEqual({ decision: 'allow', reason: '' });
  });
});

describe('Datei-Guards: Grenzen', () => {
  it('verweigert Secrets nur bei genauem Namen', () => {
    expectAll(
      ['.env', 'a/.env.production', 'C:\\proj\\.env', 'id_rsa', 'id_rsa.pub', 'ID_RSA'],
      'deny',
      f
    );
    expectAll(['a.pem', 'a/server.key', 'credentials.json'], 'deny', f);
    expectAll(
      ['my.env', 'a/.envrc', '.environment', 'x.pem.txt', 'my-credentials.json'],
      'allow',
      f
    );
  });
  it('verweigert Lockfiles nur bei genauem Namen', () => {
    expectAll(['yarn.lock', 'a/pnpm-lock.yaml', 'package-lock.json'], 'deny', f);
    expectAll(['xpackage-lock.json', 'package-lock.json.bak'], 'allow', f);
  });
  it('fragt bei Schutzdateien mit und ohne führendes Verzeichnis, nicht bei ähnlichen Namen', () => {
    expectAll(
      [
        'AGENTS.md',
        'docs/CLAUDE.md',
        '.claude/settings.local.json',
        '.husky/pre-push',
        'scripts/agent/hook-bash.mjs',
        '.github/workflows/ci.yml',
      ],
      'ask',
      f
    );
    expectAll(
      ['NOTAGENTS.md', '.claude/settings.json.bak', 'x.husky/y', 'my-scripts/agent/z'],
      'allow',
      f
    );
  });
  it('liefert Begründungen und erlaubt fehlende Pfade', () => {
    for (const p of ['.env', 'k.pem', 'yarn.lock', 'AGENTS.md']) {
      expect(evaluateFileWrite(p).reason.length, p).toBeGreaterThan(10);
    }
    expect(evaluateFileWrite(undefined)).toEqual({ decision: 'allow', reason: '' });
  });
});

describe('Stop-Hook: Grenzen', () => {
  it('schließt Dateien außerhalb von src und mit angehängter Endung aus', () => {
    const porcelain = ' M lib/src/a.ts\n M src/a.tsx.bak\n M src/ok.tsx\n';
    expect(selectChangedSources(porcelain)).toEqual(['src/ok.tsx']);
  });
  it('liefert die Prüfschritte vollständig in fester Reihenfolge', () => {
    expect(buildStopSteps(['src/a.ts'])).toEqual([
      ['npx', ['tsc', '--noEmit']],
      ['npx', ['eslint', 'src/a.ts']],
      ['npx', ['vitest', 'related', '--run', '--passWithNoTests', 'src/a.ts']],
    ]);
  });
});
