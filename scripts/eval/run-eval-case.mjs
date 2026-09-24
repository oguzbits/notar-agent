#!/usr/bin/env node
/**
 * Führt gezielt einen einzelnen Testfall oder ein Suchmuster mit promptfoo aus.
 * Nutzung:
 *   node scripts/eval/run-eval-case.mjs [fallNummerOderMuster] [--live]
 * Beispiele:
 *   node scripts/eval/run-eval-case.mjs 4
 *   node scripts/eval/run-eval-case.mjs 4 --live
 *   node scripts/eval/run-eval-case.mjs "Fall 02"
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
let isLive = false;
let pattern = '';

for (const arg of args) {
  if (arg === '--live' || arg === '-l') {
    isLive = true;
  } else if (!pattern) {
    pattern = arg;
  }
}

// Wenn eine einfache Zahl übergeben wurde (z.B. 1 oder 4), formatieren als "Fall 0X"
if (/^\d+$/.test(pattern)) {
  const num = parseInt(pattern, 10);
  pattern = `Fall ${num < 10 ? '0' : ''}${num}`;
}

const promptfooArgs = [
  'eval',
  '-c',
  'config/promptfoo.yaml',
  '--env-file',
  '.env.local',
  '--no-cache',
];

if (isLive) {
  promptfooArgs.push('-j', '1');
}

if (pattern) {
  promptfooArgs.push('--filter-pattern', pattern);
}

const env = {
  ...process.env,
  ...(isLive ? { PROMPTFOO_MODE: 'live' } : {}),
};

console.log(
  `\n🚀 Starte Promptfoo-Eval ${isLive ? '[LIVE-MODUS]' : '[MOCK-MODUS]'} ${
    pattern ? `für Filter: "${pattern}"` : 'für ALLE Fälle'
  }...\n`
);

const child = spawn('npx', ['promptfoo', ...promptfooArgs], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
