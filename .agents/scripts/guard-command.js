#!/usr/bin/env node

/**
 * PreToolUse Hook: Command Guard
 *
 * Enforces deterministic guardrails on `run_command` calls:
 * 1. Blocks unauthorized git commit / git push (Rules Discipline)
 * 2. Blocks destructive file deletions (e.g. rm -rf /, rm -rf ~)
 * 3. Blocks accidental exposure of secrets (.env, credentials)
 * 4. Intercepts package installations and requires explicit user confirmation
 */

const fs = require('fs');

function readStdin() {
  try {
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
  if (!inputRaw || !inputRaw.trim()) {
    respond('allow');
  }

  const payload = JSON.parse(inputRaw);
  const toolName = payload?.toolCall?.name;
  const args = payload?.toolCall?.args || {};

  if (toolName === 'run_command') {
    const cmd = (args.CommandLine || '').trim();

    // 1. Guard against autonomous git commit / git push
    const gitCommitOrPushRegex = /\bgit\s+(commit|push)\b/i;
    if (gitCommitOrPushRegex.test(cmd)) {
      respond(
        'deny',
        'Deterministic Guardrail: Autonomous `git commit` or `git push` is blocked. Changes must be verified and confirmed by the user first.'
      );
    }

    // 2. Guard against highly destructive file removal commands
    const dangerousRmRegex = /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+([/~]|\.\.|\*)/i;
    if (dangerousRmRegex.test(cmd)) {
      respond(
        'deny',
        `Deterministic Guardrail: Dangerous recursive deletion pattern detected in: "${cmd}".`
      );
    }

    // 3. Guard against accidental printing/leaking of secret files
    const leakSecretsRegex =
      /\b(cat|head|tail|less|more|grep)\s+.*(\.env|\.env\.local|\.env\.production|id_rsa|credentials)/i;
    if (leakSecretsRegex.test(cmd)) {
      respond(
        'deny',
        `Deterministic Guardrail: Reading raw sensitive secret files via shell is restricted: "${cmd}".`
      );
    }

    // 4. Guard against unconfirmed package installations
    const packageInstallRegex =
      /\b(npm\s+(i|install)\s+([a-zA-Z0-9@_/-]+)|yarn\s+add\s+|pnpm\s+add\s+|bun\s+add\s+)/i;
    if (packageInstallRegex.test(cmd)) {
      const isBareInstall = /\b(npm|pnpm|yarn|bun)\s+(install|ci|i)\s*$/i.test(cmd);
      if (!isBareInstall) {
        respond(
          'force_ask',
          `Deterministic Guardrail: Package installation detected ("${cmd}"). AGENTS.md requires explicit user confirmation before adding dependencies.`
        );
      }
    }
  }

  respond('allow');
} catch (err) {
  respond('allow', `Hook error: ${err.message}`);
}
