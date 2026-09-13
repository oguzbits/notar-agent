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

// Parse all `export const <NAME> = { ... } as const;` blocks dynamically from the canonical files
const CANONICAL_SOURCE_FILES = [
  'src/types/dossier.ts',
  'src/lib/supabase/repository.ts',
  'src/lib/knowledge/rules/rules-registry.ts',
  'src/lib/dossier/readiness.ts',
  'src/components/ui/StatusBadge.tsx',
];

// Files exempt from check (defining the Single Source of Truth or containing LLM prompt instructions)
const EXEMPT_FILES = [
  ...CANONICAL_SOURCE_FILES,
  'src/lib/ai/prompts.ts',
  'scripts/audit-magic-strings.mjs',
];

const SCAN_DIRS = ['src', 'e2e'];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

function extractEnumValuesFromCode(sourceCode) {
  const enumValues = new Set();

  // Match pattern: export const SOMETHING = { ... } as const;
  const dictRegex = /export\s+const\s+[A-Z0-9_]+\s*=\s*\{([\s\S]*?)\}\s*as\s+const;/g;
  let match;

  while ((match = dictRegex.exec(sourceCode)) !== null) {
    const blockContent = match[1];
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

// 1. Dynamically gather all canonical enum literals
const allCanonicalLiterals = new Set();
for (const relPath of CANONICAL_SOURCE_FILES) {
  if (fs.existsSync(relPath)) {
    const code = fs.readFileSync(relPath, 'utf-8');
    const literals = extractEnumValuesFromCode(code);
    for (const lit of literals) {
      allCanonicalLiterals.add(lit);
    }
  }
}

const ENUM_LITERALS = Array.from(allCanonicalLiterals);

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
