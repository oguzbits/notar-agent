#!/usr/bin/env node
// PreToolUse: Datei-Guard für Schreibwerkzeuge. Entscheidung: scripts/agent/guards.mjs (evaluateFileWrite).
const { runAdapter } = require('./adapter');

runAdapter(({ toolCall }, { evaluateFileWrite }) => {
  const args = toolCall?.args ?? {};
  return evaluateFileWrite(args.TargetFile || args.path || args.filePath);
});
