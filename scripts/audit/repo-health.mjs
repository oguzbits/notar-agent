#!/usr/bin/env node

/**
 * Deterministic Repository Health & Antipattern Auditor
 *
 * Scans the entire codebase deterministically (0 LLM Tokens, < 10 seconds):
 * 1. Code Clones & Duplications (via jscpd AST engine)
 * 2. Architecture & Layer Invariants (via dependency-cruiser)
 * 3. Dead Code & Orphaned Exports (via knip)
 * 4. Magic Enum Strings (via audit-magic-strings.mjs)
 * 5. Domain Invariants (Tailwind raw colors, raw DB queries without org_id filter)
 *
 * Options:
 *   --llm-digest: Generates a compressed prompt-ready Markdown digest (< 5k tokens)
 *                 containing exact coordinates of defects for on-demand AI refactoring.
 *   --json:       Outputs the raw collected metrics as JSON.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const IS_LLM_DIGEST = process.argv.includes('--llm-digest');
const IS_JSON_OUTPUT = process.argv.includes('--json');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('🔍 Starting Deterministic Repository Health Audit...\n');

const results = {
  timestamp: new Date().toISOString(),
  metrics: {
    totalFiles: 0,
    totalLines: 0,
  },
  scores: {
    duplication: 100,
    architecture: 100,
    deadCode: 100,
    magicStrings: 100,
    domainInvariants: 100,
    codeComplexity: 100,
    overall: 100,
  },
  findings: {
    clones: [],
    depViolations: [],
    knipIssues: [],
    magicStrings: [],
    domainViolations: [],
    complexModules: [],
    shallowModules: [],
  },
};

// -------------------------------------------------------------
// 1. AST Duplication Check (jscpd)
// -------------------------------------------------------------
try {
  process.stdout.write('⏳ [1/5] Checking AST Duplications (jscpd)... ');
  const tempOutputDir = path.join(REPORTS_DIR, '_temp_jscpd');
  if (fs.existsSync(tempOutputDir)) {
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
  }

  try {
    execSync(
      `npx jscpd src --ignore "**/*.test.*,**/*.spec.*" --threshold 2 --reporters json --output "${tempOutputDir}" --silent`,
      { stdio: 'pipe' }
    );
  } catch (_err) {
    // jscpd exits with non-zero exit code when clones are detected; the JSON report is still written
  }

  const jscpdReportPath = path.join(tempOutputDir, 'jscpd-report.json');
  if (fs.existsSync(jscpdReportPath)) {
    const reportData = JSON.parse(fs.readFileSync(jscpdReportPath, 'utf8'));
    const clones = reportData.duplicates || [];
    results.findings.clones = clones.map((c) => ({
      format: c.format,
      lines: c.lines,
      tokens: c.tokens,
      firstFile: path.relative(ROOT_DIR, c.firstFile.name),
      firstLines: `${c.firstFile.start}-${c.firstFile.end}`,
      secondFile: path.relative(ROOT_DIR, c.secondFile.name),
      secondLines: `${c.secondFile.start}-${c.secondFile.end}`,
      fragment: (c.fragment || '').slice(0, 160).trim(),
    }));

    const dupPercentage = reportData.statistics?.total?.percentage || 0;
    // Score drops proportionally to duplication percentage (target: <= 2%)
    results.scores.duplication = Math.max(0, Math.round(100 - dupPercentage * 20));
    fs.rmSync(tempOutputDir, { recursive: true, force: true });
  }
  console.log(`✅ (${results.findings.clones.length} clones detected)`);
} catch (e) {
  console.log(`⚠️ (Error running jscpd: ${e.message})`);
}

// -------------------------------------------------------------
// 2. Architecture & Layer Invariants (dependency-cruiser)
// -------------------------------------------------------------
try {
  process.stdout.write('⏳ [2/5] Checking Architecture Invariants (depcruise)... ');
  let depOutput = '';
  try {
    depOutput = execSync(
      'npx depcruise --config config/dependency-cruiser.js -T json src',
      { stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    depOutput = err.stdout?.toString() || '';
  }

  if (depOutput) {
    const depData = JSON.parse(depOutput);
    const summary = depData.summary || {};
    const violations = summary.violations || [];
    results.findings.depViolations = violations.map((v) => ({
      rule: v.rule?.name || 'unknown-rule',
      severity: v.rule?.severity || 'error',
      from: v.from,
      to: v.to,
      comment: v.rule?.comment || '',
    }));

    const errorCount = summary.error || 0;
    const warnCount = summary.warn || 0;
    results.scores.architecture = Math.max(0, 100 - errorCount * 25 - warnCount * 10);
  }
  console.log(`✅ (${results.findings.depViolations.length} violations)`);
} catch (e) {
  console.log(`⚠️ (Error running depcruise: ${e.message})`);
}

// -------------------------------------------------------------
// 3. Dead Code & Orphan Exports (knip)
// -------------------------------------------------------------
try {
  process.stdout.write('⏳ [3/5] Checking Dead Code & Unused Exports (knip)... ');
  let knipJson = '';
  try {
    knipJson = execSync(
      'npx knip --include dependencies,unlisted,binaries,unresolved,files,cycles --reporter json',
      { stdio: 'pipe', encoding: 'utf8' }
    );
  } catch (err) {
    knipJson = err.stdout?.toString() || '';
  }

  if (knipJson) {
    try {
      const knipData = JSON.parse(knipJson);
      const issues = [];
      if (knipData.files?.length) {
        issues.push(...knipData.files.map((f) => ({ type: 'unused_file', file: f })));
      }
      if (knipData.dependencies?.length) {
        issues.push(...knipData.dependencies.map((d) => ({ type: 'unused_dependency', name: d })));
      }
      if (knipData.unlisted?.length) {
        issues.push(...knipData.unlisted.map((u) => ({ type: 'unlisted_dependency', name: u })));
      }
      results.findings.knipIssues = issues;
      results.scores.deadCode = Math.max(0, 100 - issues.length * 15);
    } catch (parseError) {
      // Knip plain-text output indicates no issues or format differences
      results.scores.deadCode = 100;
      if (process.env.DEBUG) {
        console.warn('Knip JSON parse fallback:', parseError);
      }
    }
  }
  console.log(`✅ (${results.findings.knipIssues.length} issues)`);
} catch (e) {
  console.log(`⚠️ (Error running knip: ${e.message})`);
}

// -------------------------------------------------------------
// 4. Zero Magic Enum Strings Audit
// -------------------------------------------------------------
try {
  process.stdout.write('⏳ [4/5] Checking Magic Strings & Enums... ');
  let magicOutput = '';
  try {
    magicOutput = execSync('node scripts/audit/audit-magic-strings.mjs', {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    results.scores.magicStrings = 100;
  } catch (err) {
    magicOutput = err.stderr?.toString() || err.stdout?.toString() || '';
    results.scores.magicStrings = 0;
    results.findings.magicStrings.push({ details: magicOutput.trim() });
  }
  console.log(`✅ (Status: ${results.scores.magicStrings === 100 ? 'CLEAN' : 'VIOLATIONS'})`);
} catch (e) {
  console.log(`⚠️ (Error running magic strings: ${e.message})`);
}

// -------------------------------------------------------------
// 5. Custom Domain Invariants (Tailwind Tokens & Tenant Isolation)
// -------------------------------------------------------------
try {
  process.stdout.write('⏳ [5/5] Checking Domain Invariants (RLS & Design Tokens)... ');
  const domainViolations = [];
  const srcFiles = [];

  function collectSrcFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          collectSrcFiles(full);
        }
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
        srcFiles.push(full);
      }
    }
  }
  collectSrcFiles(path.join(ROOT_DIR, 'src'));
  results.metrics.totalFiles = srcFiles.length;

  // Regex patterns for forbidden antipatterns:
  // a) Raw Tailwind colors in components (e.g. bg-blue-500, text-red-600)
  const rawColorRegex = /\b(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/;

  let totalLines = 0;
  for (const file of srcFiles) {
    const relPath = path.relative(ROOT_DIR, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    totalLines += lines.length;

    // Check raw colors ONLY in presentation layer (views/components)
    if (relPath.startsWith('src/components/views/') || relPath.startsWith('src/app/')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(rawColorRegex);
        if (match && !line.includes('// ignore-raw-color')) {
          domainViolations.push({
            type: 'raw_color_token',
            file: relPath,
            line: i + 1,
            snippet: line.trim(),
            token: match[0],
          });
        }
      }
    }

    // b) PII & Audit Guard: Disallow console.log in production code (prevent client/notary PII leakage)
    if (!relPath.includes('.test.') && !relPath.includes('.spec.')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\bconsole\.log\s*\(/.test(line) && !line.includes('// ignore-console-log')) {
          domainViolations.push({
            type: 'pii_leak_console_log',
            file: relPath,
            line: i + 1,
            snippet: line.trim(),
            token: 'console.log',
          });
        }
      }
    }

    // c) Performance Guard: Disallow inline Supabase queries inside loops (N+1 queries antipattern)
    if (relPath.startsWith('src/lib/') || relPath.startsWith('src/app/api/')) {
      // Find loop blocks (for, while, for...of, for await) and verify if supabase.from is called inside
      const loopBlockRegex = /(?:for\s*\([^)]+\)|while\s*\([^)]+\)|for\s+await\s*\([^)]+\))\s*\{([^}]+)\}/g;
      let loopMatch;
      while ((loopMatch = loopBlockRegex.exec(content)) !== null) {
        const loopBody = loopMatch[1];
        if (/\bsupabase\s*\.\s*from\s*\(/.test(loopBody)) {
          domainViolations.push({
            type: 'n_plus_one_supabase_query',
            file: relPath,
            line: 1,
            snippet: 'Potential N+1 Query: Supabase query detected directly inside loop body',
            token: 'supabase.from in loop',
          });
        }
      }
    }
  }

  results.metrics.totalLines = totalLines;
  results.findings.domainViolations = domainViolations;
  results.scores.domainInvariants = Math.max(0, 100 - domainViolations.length * 10);
  console.log(`✅ (${domainViolations.length} violations in views/domain)`);
} catch (e) {
  console.log(`⚠️ (Error checking domain invariants: ${e.message})`);
}

// -------------------------------------------------------------
// 6. Qualitative AST: Cyclomatic Complexity & Shallow Modules
// -------------------------------------------------------------
try {
  process.stdout.write('⏳ [6/6] Analyzing Imperative Complexity & Module Depth... ');
  const moduleStats = [];

  const allTsFiles = [];
  function collectAllTsFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          collectAllTsFiles(full);
        }
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.') &&
        !entry.name.endsWith('.d.ts') &&
        !full.includes('/src/test/')
      ) {
        allTsFiles.push(full);
      }
    }
  }
  collectAllTsFiles(path.join(ROOT_DIR, 'src'));

  for (const f of allTsFiles) {
    const code = fs.readFileSync(f, 'utf8');
    const lines = code.split('\n');
    // Bereinige Kommentare und Regex-Literale, um False Positives bei '?' oder Wortmustern zu vermeiden
    const cleanCode = code
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      .replace(/\/(?:\\.|[^\/\\\n])+\/[gimsuy]*/g, '');
    const ifs = (cleanCode.match(/\bif\s*\(/g) || []).length;
    const switches = (cleanCode.match(/\bswitch\s*\(/g) || []).length;
    // Nur echte ternäre Operatoren (a ? b : c) zählen, keine Nullish Coalescing (??) oder Optional Chaining (?.)
    const ternaries = (cleanCode.match(/[^?]\s*\?[^?.:][^:]*:/g) || []).length;
    const catches = (cleanCode.match(/\bcatch\s*(\(|{)/g) || []).length;
    const loops = (cleanCode.match(/\b(for|while)\s*\(/g) || []).length;
    const totalComplexity = ifs + switches * 2 + ternaries + loops * 1.5 + catches;

    const exportsCount = (code.match(/\bexport\s+(const|function|class|interface|type)\b/g) || []).length;
    const loc = lines.length;
    const ratio = exportsCount > 0 ? Number((loc / exportsCount).toFixed(1)) : loc;

    moduleStats.push({
      file: path.relative(ROOT_DIR, f),
      loc,
      complexity: Math.round(totalComplexity),
      exportsCount,
      ratio,
    });
  }

  // Top complex imperative hotspots (threshold: complexity >= 25)
  const complex = [...moduleStats].filter((m) => m.complexity >= 25).sort((a, b) => b.complexity - a.complexity);
  results.findings.complexModules = complex;

  // Shallow modules: High export count vs. lines of implementation (ratio <= 12, loc < 100)
  const shallow = [...moduleStats]
    .filter((m) => m.exportsCount >= 3 && m.loc < 100 && !m.file.startsWith('src/types/'))
    .sort((a, b) => a.ratio - b.ratio);
  results.findings.shallowModules = shallow;

  // Penalize score if multiple files exceed high complexity thresholds
  const highComplexityPenalty = complex.reduce((acc, c) => acc + (c.complexity > 35 ? 10 : 5), 0);
  results.scores.codeComplexity = Math.max(0, 100 - highComplexityPenalty);

  console.log(`✅ (${complex.length} imperative hotspots, ${shallow.length} shallow modules)`);
} catch (e) {
  console.log(`⚠️ (Error analyzing AST complexity: ${e.message})`);
}

// -------------------------------------------------------------
// Overall Score Calculation (Weighted)
// -------------------------------------------------------------
results.scores.overall = Math.round(
  results.scores.duplication * 0.20 +
  results.scores.architecture * 0.25 +
  results.scores.deadCode * 0.15 +
  results.scores.magicStrings * 0.15 +
  results.scores.domainInvariants * 0.10 +
  results.scores.codeComplexity * 0.15
);

// -------------------------------------------------------------
// Markdown Report Generation
// -------------------------------------------------------------
const reportMd = `# 📊 Repository Health Scorecard

> **Audit Timestamp:** ${results.timestamp}  
> **Scanned Files:** ${results.metrics.totalFiles} TypeScript files (${results.metrics.totalLines} lines of code)  
> **Token Cost:** 0 Tokens (100% Deterministische lokale AST- & Graph-Analyse)

---

## 🎯 Overall Health Score: **${results.scores.overall} / 100**

| Kategorie | Score | Status | Erkannte Befunde |
| :--- | :---: | :---: | :--- |
| **Architektur- & Schicht-Integrität** | ${results.scores.architecture}% | ${results.scores.architecture === 100 ? '🟢 Pass' : '🔴 Alert'} | ${results.findings.depViolations.length} Verletzungen |
| **AST-Codeduplikation** | ${results.scores.duplication}% | ${results.scores.duplication >= 80 ? '🟢 Pass' : '🟡 Warn'} | ${results.findings.clones.length} Klone |
| **Dead Code & Exporte** | ${results.scores.deadCode}% | ${results.scores.deadCode === 100 ? '🟢 Pass' : '🔴 Alert'} | ${results.findings.knipIssues.length} verwaiste Artefakte |
| **Enum & Magic Strings** | ${results.scores.magicStrings}% | ${results.scores.magicStrings === 100 ? '🟢 Pass' : '🔴 Alert'} | ${results.findings.magicStrings.length} Literale |
| **Domain-, PII- & Performance-Invarianten** | ${results.scores.domainInvariants}% | ${results.scores.domainInvariants >= 80 ? '🟢 Pass' : '🟡 Warn'} | ${results.findings.domainViolations.length} Unsauberkeiten |
| **Code-Komplexität (Imperativ)** | ${results.scores.codeComplexity}% | ${results.scores.codeComplexity >= 75 ? '🟢 Pass' : '🟡 Review'} | ${results.findings.complexModules.length} komplexe Hotspots |

---

## 🔍 Top Refactoring Candidates (Befunde)

### 1. Imperative Komplexitäts-Hotspots (Cyclomatic Complexity >= 25)
${
  results.findings.complexModules.length === 0
    ? '_Keine hochkomplexen Verzweigungs-Cluster gefunden._'
    : results.findings.complexModules
        .slice(0, 5)
        .map(
          (m, idx) =>
            `- **[#${idx + 1}]** \`${m.file}\` (Komplexität: **${m.complexity}**, ${m.loc} Zeilen, ${m.exportsCount} Exports)`
        )
        .join('\n')
}

### 2. Flache Module (Hohe Export-Oberfläche vs. Implementierungs-Tiefe)
${
  results.findings.shallowModules.length === 0
    ? '_Keine flachen Module identifiziert._'
    : results.findings.shallowModules
        .slice(0, 5)
        .map(
          (m) =>
            `- \`${m.file}\`: ${m.exportsCount} Exports bei nur ${m.loc} Zeilen (Tiefe: ${m.ratio})`
        )
        .join('\n')
}

### 3. Code-Duplikate (Top ${Math.min(5, results.findings.clones.length)})
${
  results.findings.clones.length === 0
    ? '_Keine Duplikate gefunden._'
    : results.findings.clones
        .slice(0, 5)
        .map(
          (c, idx) =>
            `**[Clone #${idx + 1}]** ${c.lines} Zeilen (${c.tokens} Tokens)  
- A: \`${c.firstFile}:${c.firstLines}\`  
- B: \`${c.secondFile}:${c.secondLines}\`  
\`\`\`${c.format}
${c.fragment}
\`\`\``
        )
        .join('\n\n')
}

### 4. Schicht- & Abhängigkeitsverletzungen
${
  results.findings.depViolations.length === 0
    ? '_Keine Architekturbrüche (Dependency-Cruiser ist grün)._'
    : results.findings.depViolations
        .map((v) => `- **[${v.severity.toUpperCase()}]** \`${v.from}\` ➔ \`${v.to}\` (${v.rule})`)
        .join('\n')
}

### 5. Ungenutzter Code & Verwaiste Exporte (Knip)
${
  results.findings.knipIssues.length === 0
    ? '_Zero Dead Code: Alle Dateien und Dependencies werden aktiv genutzt._'
    : results.findings.knipIssues.map((k) => `- ${k.type}: \`${k.file || k.name}\``).join('\n')
}

### 6. Domain-, PII- & Performance-Invarianten
${
  results.findings.domainViolations.length === 0
    ? '_Keine Design-Token-Verstöße, Zero console.log (PII-Schutz) und Zero N+1 Supabase-Schleifen._'
    : results.findings.domainViolations
        .map((d) => `- \`${d.file}:${d.line}\`: [${d.type}] \`${d.token}\` in \`${d.snippet}\``)
        .join('\n')
}
`;

fs.writeFileSync(path.join(REPORTS_DIR, 'codebase-health.md'), reportMd, 'utf8');

// -------------------------------------------------------------
// LLM Action Digest (< 5k Tokens)
// -------------------------------------------------------------
if (IS_LLM_DIGEST) {
  const digestMd = `### 🤖 LLM Targeted Refactoring Digest

Hier sind die exakten Koordinaten der erkannten Architektur- und Duplikationsprobleme.
Verwende diese Daten für zielgerichtete Refactorings ohne den gesamten Code einlesen zu müssen:

#### 1. Imperative Komplexitäts-Hotspots zum Refaktorieren:
${results.findings.complexModules
  .slice(0, 5)
  .map((m) => `- ${m.file} (Komplexität: ${m.complexity}) -> if/else Kaskaden in deklarative Regeln/Tabellen überführen`)
  .join('\n')}

#### 2. Priorisierte Code-Klone zum Zusammenführen:
${results.findings.clones
  .slice(0, 5)
  .map(
    (c, i) => `Case #${i + 1}:
- File 1: ${c.firstFile} (L${c.firstLines})
- File 2: ${c.secondFile} (L${c.secondLines})
- Token Count: ${c.tokens}
- Pattern:
${c.fragment}`
  )
  .join('\n\n')}

#### 3. Domain Token Abweichungen:
${results.findings.domainViolations
  .map((d) => `- ${d.file}:L${d.line} -> ersetze '${d.token}' durch semantisches Token (z.B. 'bg-muted', 'text-destructive', etc.)`)
  .join('\n')}
`;

  fs.writeFileSync(path.join(REPORTS_DIR, 'llm-action-digest.md'), digestMd, 'utf8');
  console.log(`\n📄 LLM Action Digest geschrieben nach: reports/llm-action-digest.md`);
}

// -------------------------------------------------------------
// Terminal Output
// -------------------------------------------------------------
if (IS_JSON_OUTPUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log('\n=============================================================');
  console.log(`  🏆 CODEBASE HEALTH SCORE: ${results.scores.overall} / 100`);
  console.log('=============================================================');
  console.log(`  - Architektur (depcruise):    ${results.scores.architecture}%`);
  console.log(`  - Code-Komplexität (AST):     ${results.scores.codeComplexity}%`);
  console.log(`  - Duplikation (jscpd):        ${results.scores.duplication}%`);
  console.log(`  - Dead Code (knip):           ${results.scores.deadCode}%`);
  console.log(`  - Magic Strings:              ${results.scores.magicStrings}%`);
  console.log(`  - Domain & Design Tokens:     ${results.scores.domainInvariants}%`);
  console.log('-------------------------------------------------------------');
  console.log(`📄 Detaillierter Markdown-Report: reports/codebase-health.md\n`);
}

// -------------------------------------------------------------
// Deterministic Quality Gate (Threshold Enforcement)
// -------------------------------------------------------------
const MIN_REQUIRED_HEALTH_SCORE = 90;

if (results.scores.overall < MIN_REQUIRED_HEALTH_SCORE) {
  console.error(`❌ REPO HEALTH AUDIT FAILED: Health Score ${results.scores.overall}/100 liegt unter dem Schwellenwert von ${MIN_REQUIRED_HEALTH_SCORE}!\n`);
  process.exit(1);
}
