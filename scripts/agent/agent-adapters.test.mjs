// Die Adapter unter .agents/scripts übersetzen nur das Protokoll des zweiten Agentenwerkzeugs;
// die Entscheidung kommt aus guards.mjs. Aufruf wie im Werkzeug: JSON auf stdin, JSON auf stdout.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const agentsDir = resolve(import.meta.dirname, '../../.agents');

const run = (script, toolCall) => {
  const res = spawnSync('node', [resolve(agentsDir, 'scripts', script)], {
    input: JSON.stringify({ toolCall }),
    encoding: 'utf8',
  });
  return JSON.parse(res.stdout);
};
const cmd = (CommandLine) => run('guard-command.js', { name: 'run_command', args: { CommandLine } });
const file = (TargetFile) => run('guard-file.js', { name: 'write_to_file', args: { TargetFile } });

describe('.agents/hooks.json', () => {
  it('verweist nur auf vorhandene Skripte (Pfade relativ zu .agents)', () => {
    const config = JSON.parse(readFileSync(resolve(agentsDir, 'hooks.json'), 'utf8'));
    const commands = Object.values(config).flatMap((guard) =>
      Object.values(guard)
        .filter(Array.isArray)
        .flat()
        .flatMap((entry) => entry.hooks ?? [entry])
        .map((hook) => hook.command)
    );
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      const script = command.replace(/^node\s+/, '');
      expect(existsSync(resolve(agentsDir, script)), command).toBe(true);
    }
  });
});

describe('Adapter nutzen dieselbe Entscheidung wie die Claude-Hooks', () => {
  it('erlaubt Commit und normalen Push, verweigert Force-Push und --no-verify', () => {
    expect(cmd('git commit -m "x"').decision).toBe('allow');
    expect(cmd('git push origin main').decision).toBe('allow');
    expect(cmd('git push --force').decision).toBe('deny');
    expect(cmd('git commit --no-verify -m x').decision).toBe('deny');
  });
  it('übersetzt "ask" in das Protokoll des Werkzeugs (force_ask)', () => {
    expect(cmd('git reset --hard HEAD~1').decision).toBe('force_ask');
  });
  it('sperrt Secrets, fragt bei Schutzdateien, erlaubt Quellen', () => {
    expect(file('/a/.env.local').decision).toBe('deny');
    expect(file('/a/scripts/agent/guards.mjs').decision).toBe('force_ask');
    expect(file('/a/src/lib/x.ts').decision).toBe('allow');
  });
});
