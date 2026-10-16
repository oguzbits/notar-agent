// Statische Sicherheitsanalyse (Semgrep) – lokal und in der CI mit identischem Aufruf.
// Version ist festgelegt, damit Ergebnisse reproduzierbar bleiben.
import { spawnSync } from 'node:child_process';

const SEMGREP_VERSION = '1.170.0';
const ARGS = [
  'scan',
  '--config',
  'auto',
  '--error',
  '--exclude-rule',
  'yaml.github-actions.security.github-actions-mutable-action-tag.github-actions-mutable-action-tag',
  'src',
  'scripts',
];

const probe = spawnSync('semgrep', ['--version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  const message = `Semgrep nicht gefunden. Installation: pipx install semgrep==${SEMGREP_VERSION}`;
  if (process.env.CI) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.warn(`⚠️  SAST übersprungen (lokal). ${message}`);
  process.exit(0);
}

const installed = probe.stdout.trim();
if (installed !== SEMGREP_VERSION) {
  console.warn(`⚠️  Semgrep ${installed} statt festgelegter Version ${SEMGREP_VERSION}.`);
}

const run = spawnSync('semgrep', ARGS, { stdio: 'inherit' });
process.exit(run.status ?? 1);
