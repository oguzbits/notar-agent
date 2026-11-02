// Aufruf: node scripts/audit/audit-docs-drift.mjs --base <ref>  (Standard: origin/main)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findDrift, isWaived, parseCovers } from './docs-drift.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const argIndex = process.argv.indexOf('--base');
const base = argIndex > -1 ? process.argv[argIndex + 1] : 'origin/main';

try {
  git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
} catch (error) {
  // z. B. erster Push eines neuen Branchs (Basis 0000…): nichts zu vergleichen
  console.log(`⏭️  Doku-Drift: Basis "${base}" unbekannt, Prüfung übersprungen (${error.status}).`);
  process.exit(0);
}

const changed = git('diff', '--name-only', `${base}..HEAD`).split('\n').filter(Boolean);
const waived = isWaived(git('log', '--format=%B', `${base}..HEAD`));
const specs = git('ls-files', 'docs/ARCHITECTURE.md', 'docs/DESIGN.md', 'docs/architecture')
  .split('\n')
  .filter((file) => file.endsWith('.md'))
  .map((path) => ({ path, covers: parseCovers(readFileSync(path, 'utf8')) }))
  .filter((spec) => spec.covers.length > 0);

const drift = findDrift({ changed, docs: specs, waived });
if (drift.length > 0) {
  console.error(
    `❌ Doku-Drift (Invariante 9): Code geändert, Spezifikation nicht.\n${drift
      .map((d) => `  - ${d.doc}\n${d.files.map((f) => `      ${f}`).join('\n')}`)
      .join(
        '\n'
      )}\n  Spezifikation im selben Änderungssatz anpassen, oder im Commit-Text die Zeile "Docs: unverändert" ergänzen.`
  );
  process.exit(1);
}
console.log(`✅ Doku-Drift: ${specs.length} Spezifikationen geprüft (${changed.length} Dateien).`);
