// Doku-Drift (AGENTS.md Invariante 9): Wer Code unter den `covers:`-Pfaden einer Spezifikation ändert,
// ändert im selben Änderungssatz die Spezifikation oder erklärt per "Docs: unverändert" im Commit-Text, warum nicht.

const WAIVER = /^Docs: unverändert\s*$/m;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

export function parseCovers(text) {
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!front) return [];
  const block = front[1].match(/^covers:\n((?:[ \t]+-[ \t]+.+\n?)+)/m);
  if (!block) return [];
  return block[1]
    .split('\n')
    .map((line) => line.match(/^[ \t]+-[ \t]+(.+?)\s*$/)?.[1])
    .filter(Boolean);
}

export function isWaived(commitMessages) {
  return WAIVER.test(commitMessages);
}

export function findDrift({ changed, docs, waived }) {
  if (waived) return [];
  const touched = new Set(changed);
  return docs
    .filter((doc) => !touched.has(doc.path))
    .map((doc) => ({
      doc: doc.path,
      files: changed.filter(
        (file) => !TEST_FILE.test(file) && doc.covers.some((prefix) => file.startsWith(prefix))
      ),
    }))
    .filter((entry) => entry.files.length > 0);
}
