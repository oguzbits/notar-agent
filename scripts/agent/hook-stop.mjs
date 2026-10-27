// Stop-Hook: schnelle Verifikation geänderter Quelldateien (Typprüfung, Lint, betroffene Tests).
// Das volle `npm run check` bleibt Pre-push und CI. Bei Fehlern wird das Beenden blockiert.
import { execFileSync, spawnSync } from 'node:child_process';
import { buildStopSteps, selectChangedSources } from './guards.mjs';
import { readInput } from './hook-io.mjs';

const input = readInput();
if (input.stop_hook_active) process.exit(0); // Endlosschleife vermeiden

const porcelain = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });

for (const [cmd, args] of buildStopSteps(selectChangedSources(porcelain))) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 90_000 });
  if (result.status !== 0) {
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-3000);
    process.stderr.write(
      `Verifikation fehlgeschlagen (${cmd} ${args.slice(0, 2).join(' ')}):\n${out}\n`
    );
    process.exit(2);
  }
}
