// Docs-Audit (AGENTS.md Invarianten 7, 9, 11): portable Pfade, auflösbare Links, keine Aufgabenlisten in Spezifikationen.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '*.md'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter((f) => existsSync(f));

// AGENTS.md nennt die verbotenen Muster als Beispiel und ist von der Pfadprüfung ausgenommen
const ABSOLUTE_PATH = /(file:\/\/\/|\/Users\/[\w.-]+\/|[A-Z]:\\Users\\)/;
const TASK_BOX = /^\s*[-*]\s+\[[ xX]\]\s/m;
// Aufgabenlisten gehören ausschließlich in ROADMAP.md, BACKLOG.md, CHANGELOG.md und Arbeitsdokumente
const SPEC_FILES = (f) =>
  f === 'AGENTS.md' || f === 'docs/overview.md' || f.startsWith('docs/architecture/');
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const withoutCode = text.replace(/```[\s\S]*?```/g, '');

  const abs = file === 'AGENTS.md' ? null : withoutCode.match(ABSOLUTE_PATH);
  if (abs) problems.push(`${file}: absoluter Maschinenpfad "${abs[0]}" (Invariante 7)`);

  if (SPEC_FILES(file) && TASK_BOX.test(withoutCode) && file !== 'AGENTS.md') {
    problems.push(`${file}: Aufgabenliste in Spezifikation (Invariante 11); gehört in ROADMAP.md`);
  }

  for (const [, target] of withoutCode.matchAll(LINK)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURIComponent(target.split('#')[0]);
    if (!path) continue;
    if (!existsSync(resolve(dirname(file), path))) {
      problems.push(`${file}: Link ins Leere "${target}"`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    `❌ Docs-Audit: ${problems.length} Problem(e)\n${problems.map((p) => `  - ${p}`).join('\n')}`
  );
  process.exit(1);
}
console.log(`✅ Docs-Audit bestanden (${files.length} Markdown-Dateien).`);
