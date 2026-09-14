#!/usr/bin/env node

/**
 * Stop Hook: Verification Gate
 *
 * Runs when the agent attempts to conclude its turn.
 * Ensures that if code files in the repo were modified, TypeScript type-check
 * passes without errors before the agent can stop.
 */

const { execSync } = require('child_process');

function readStdin() {
  try {
    const fs = require('fs');
    return fs.readFileSync(0, 'utf-8');
  } catch (err) {
    process.stderr.write(`Failed to read stdin: ${err.message}\n`);
    return '';
  }
}

function respond(decision, reason) {
  const payload = {
    decision,
    reason: reason || '',
  };
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(0);
}

try {
  const inputRaw = readStdin();
  const payload = inputRaw ? JSON.parse(inputRaw) : {};

  // If stopping due to user cancel or error, do not block
  if (payload.terminationReason && payload.terminationReason !== 'model_stop') {
    respond('allow');
  }

  // Check if working tree has modified ts/tsx/js files
  let statusOutput = '';
  try {
    statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
  } catch {
    // If not in git or error, allow
    respond('allow');
  }

  const hasCodeChanges = statusOutput
    .split('\n')
    .some((line) => /\.(ts|tsx|js|mjs)$/.test(line.trim()));

  if (hasCodeChanges) {
    // Perform quick type-check
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe', encoding: 'utf-8' });
    } catch (tscErr) {
      const output = tscErr.stdout || tscErr.stderr || tscErr.message;
      respond(
        'continue',
        `Deterministic Verification Gate: TypeScript type-check failed. You must fix these compiler errors before completing the task:\n\n${output.slice(0, 1500)}`
      );
    }
  }

  respond('allow');
} catch (err) {
  respond('allow', `Hook error: ${err.message}`);
}
