#!/usr/bin/env node
// PreToolUse: Befehls-Guard für `run_command`. Entscheidung: scripts/agent/guards.mjs (evaluateCommand).
const { runAdapter } = require('./adapter');

runAdapter(({ toolCall }, { evaluateCommand }) =>
  toolCall?.name === 'run_command'
    ? evaluateCommand(toolCall.args?.CommandLine)
    : { decision: 'allow' }
);
