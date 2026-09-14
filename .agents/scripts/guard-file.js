#!/usr/bin/env node

/**
 * PreToolUse Hook: File Guard
 *
 * Enforces deterministic guardrails on file manipulation tools:
 * (write_to_file, replace_file_content, multi_replace_file_content)
 *
 * 1. Blocks writing/modifying secret and environment files (.env*, credentials, pem/key)
 * 2. Blocks direct manual modifications of package-lock.json (should be managed by npm)
 * 3. Enforces user review (force_ask) for sensitive configuration files (e.g. AGENTS.md, hooks.json)
 */

const fs = require('fs');
const path = require('path');

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
  const args = payload?.toolCall?.args || {};

  // Extract targeted file path from args (TargetFile for write_to_file / replace_file_content)
  const targetFilePath = (args.TargetFile || args.path || args.filePath || '').trim();

  if (targetFilePath) {
    const baseName = path.basename(targetFilePath);

    // 1. Hard-block writing or modifying environment files & secrets
    const secretFileRegex = /^(\.env|\.env\..*|id_rsa.*|.*\.pem|.*\.key|credentials\.json)$/i;
    if (secretFileRegex.test(baseName)) {
      respond(
        'deny',
        `Deterministic Guardrail: Modifying secrets/environment files directly ("${baseName}") is prohibited to prevent accidental credential leakage or corruption.`
      );
    }

    // 2. Prevent direct manual editing of lockfiles
    if (
      baseName === 'package-lock.json' ||
      baseName === 'pnpm-lock.yaml' ||
      baseName === 'yarn.lock'
    ) {
      respond(
        'deny',
        `Deterministic Guardrail: Manual modification of "${baseName}" is blocked. Lockfiles must be updated deterministically via package managers.`
      );
    }

    // 3. User confirmation required for altering system governance files
    if (baseName === 'hooks.json' || baseName === 'AGENTS.md') {
      respond(
        'force_ask',
        `Deterministic Guardrail: Modification of agent governance file "${baseName}" requires explicit user confirmation.`
      );
    }
  }

  respond('allow');
} catch (err) {
  respond('allow', `Hook error: ${err.message}`);
}
