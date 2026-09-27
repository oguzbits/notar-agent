#!/usr/bin/env node

/**
 * CI Audit Script: Zero Magic Enum Strings (Dynamic Introspection)
 *
 * Automatically inspects ALL canonical enum dictionaries across the codebase:
 * - src/types/dossier.ts (CASE_TYPES, FIELD_STATUS, OVERALL_STATUS, etc.)
 * - src/lib/supabase/repository.ts (CASE_STATUS)
 * - src/lib/knowledge/rules/rules-registry.ts (AUDIT_RULE_IDS, AUDIT_RULE_CATEGORIES)
 * - src/lib/dossier/readiness.ts (READINESS_STAGES)
 * - src/components/ui/StatusBadge.tsx (SPECIAL_CASE_STATUS)
 *
 * Scans the codebase to ensure these canonical values are NEVER written as raw string literals
 * outside their declaring modules.
 */

import fs from 'node:fs';
import path from 'node:path';

// Scan directories and file extensions
const SCAN_DIRS = ['src', 'e2e'];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

// Explicit exemptions (e.g. system prompts or audit tools themselves)
const BASE_EXEMPT_FILES = [
  'src/lib/ai/prompts.ts',
  'scripts/audit/audit-magic-strings.mjs',
];

function collectFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile() && FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractEnumValuesFromCode(sourceCode) {
  const enumValues = new Set();

  // Match pattern: export const UPPER_SNAKE_CASE = { ... } as const;
  const dictRegex = /export\s+const\s+([A-Z0-9_]+)\s*=\s*\{([\s\S]*?)\}\s*as\s+const;/g;
  let match;

  while ((match = dictRegex.exec(sourceCode)) !== null) {
    const blockContent = match[2];
    // Match each key-value pair: KEY: 'VALUE' or KEY: "VALUE"
    const pairRegex = /:\s*(['"`])([^'"`]+)\1/g;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(blockContent)) !== null) {
      const val = pairMatch[2].trim();
      if (val.length > 0) {
        enumValues.add(val);
      }
    }
  }

  return Array.from(enumValues);
}

// 1. DYNAMIC AUTO-DISCOVERY: Scan all files to find any that declare canonical `as const` dictionaries
const discoveredCanonicalFiles = new Set();
const allCanonicalLiterals = new Set();

const allSourceFiles = [];
for (const dir of SCAN_DIRS) {
  if (fs.existsSync(dir)) {
    allSourceFiles.push(...collectFiles(dir));
  }
}

for (const file of allSourceFiles) {
  const code = fs.readFileSync(file, 'utf-8');
  const literals = extractEnumValuesFromCode(code);
  if (literals.length > 0) {
    discoveredCanonicalFiles.add(file.replace(/\\/g, '/'));
    for (const lit of literals) {
      allCanonicalLiterals.add(lit);
    }
  }
}

const ENUM_LITERALS = Array.from(allCanonicalLiterals);
const EXEMPT_FILES = [
  ...Array.from(discoveredCanonicalFiles),
  ...BASE_EXEMPT_FILES,
];


const violations = [];

for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = collectFiles(dir);

  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, '/');
    if (EXEMPT_FILES.some((exempt) => normalizedFile.endsWith(exempt))) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      // Skip comment-only lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      for (const literal of ENUM_LITERALS) {
        // Escape special regex chars in literal (like spaces in "In Prüfung")
        const escaped = literal.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(['"\`])${escaped}\\1`);
        if (regex.test(line)) {
          violations.push({
            file: normalizedFile,
            line: i + 1,
            lineContent: line.trim(),
            literal,
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\n❌ Magic enum string violations detected:');
  console.error('Use canonical `as const` dictionaries instead of raw string literals.\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> Found raw '${v.literal}'`);
    console.error(`    ${v.lineContent}`);
  }
  console.error(`\nTotal violations: ${violations.length}\n`);
  process.exit(1);
} else {
  console.log(`✅ Audit passed: Introspected ${ENUM_LITERALS.length} canonical enum values across codebase. Zero raw magic enum strings found.`);
  process.exit(0);
}
