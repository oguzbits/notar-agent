import { readFileSync } from 'node:fs';

export function readInput() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    process.stderr.write(`Hook-Eingabe nicht lesbar: ${err.message}\n`);
    return {};
  }
}

/** Antwort im Claude-Code-Format für PreToolUse-Hooks. */
export function respondPreToolUse({ decision, reason }) {
  if (decision !== 'allow') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: decision,
          permissionDecisionReason: reason,
        },
      })
    );
  }
  process.exit(0);
}
