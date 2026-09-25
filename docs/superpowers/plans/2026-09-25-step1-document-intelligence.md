# Step 1 Document Intelligence & Live Model Modernization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernisierung von Step 1 der Notar-Agent-Pipeline durch strukturiertes, Layout-bewusstes Block-Parsing und deterministische Faktenprüfung (inspiriert vom Sarvam-VLM/SSM-Ansatz) bei 100 % Cloud-API-Betrieb, sowie vollständige Bereinigung aller veralteten Modell-IDs im Repo gemäß neuer Systemregel 10.

**Architecture:**

1. **Model Governance via Environment SSOT:** Vollständige, dynamische Modell-Konfiguration rein über Umgebungsvariablen (`.env` / `src/env.ts`) ohne statisch fest verdrahtete Hilfsdateien im Codebase.
2. **Layout & Block Harness in Step 1:** Erweiterung des Ingestion-Layers um blockbasiertes Layout-Parsing (Markdown-Strukturierung von Tabellen und Klauseln mit logischer Bindung vor der Zod-Objektextraktion).
3. **Deterministische Faktenprüfung (Verifiable Constraints):** Mathematische Prüfungen (Summen, Raten, Fristen) und Snippet-Existenzprüfung im Originaltext vor Abschluss von Step 1.

**Tech Stack:** Next.js 16, TypeScript (strict), Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`), Zod, unpdf, Vitest.

---

## Global Constraints

- 100 % Cloud-API-basiert: Keine lokalen Modelle, keine On-Prem-GPUs.
- Striktes Befolgen von Invariante 10 (`AGENTS.md`): Keine veralteten Modellbezeichner; Modell-Strings sind entkoppelt und werden rein über `.env` injiziert.
- Canonical German Notary Terminology: Reine deutsche Fachbegriffe in UI und Fehlermeldungen.
- Volle Kompatibilität mit dem 4-Layer-Evaluierungs-Framework (`npm run check` und `npm test` müssen 0 Fehler melden).

---

### Task 1: Bereinigung veralteter Modell-Referenzen & Dynamische Env-Steuerung (Erledigt)

**Files:**

- Modify: `src/lib/ai/ai-provider.ts`
- Modify: `src/test/eval/promptfoo-provider.ts`
- Modify: `src/env.ts`
- Modify: `docs/eval-scaling-plan.md`
- Test: `src/lib/ai/ai-provider.test.ts`

**Interfaces:**

- Produces: Dynamische Auflösung von `env.AI_MODEL` und `env.EVAL_*_AI_MODEL` mit Fail-Fast-Validierung bei fehlender Konfiguration.

- [x] **Step 1: Keine statischen Code-Mappings/Dateien – Steuerung 100 % über Environment-Schema (`src/env.ts`)**
- [x] **Step 2: `ai-provider.ts` und `promptfoo-provider.ts` bereinigen und dynamisch an `env.AI_MODEL` anbinden**
- [x] **Step 3: Veraltete Modell-Referenzen in Dokumenten aktualisieren**
- [x] **Step 4: Testlauf und Quality Gates verifizieren (`npm run check` & `npm test` 100 % grün)**

---

### Task 2: Block-Level Layout-Awareness & Reading Order Harness in Step 1

**Files:**

- Create: `src/lib/files/layout-structure-parser.ts`
- Modify: `src/lib/ai/payload-assembler.ts`
- Test: `src/lib/files/layout-structure-parser.test.ts`

**Interfaces:**

- Consumes: Raw text / PDF streams from `pdf-text-extractor.ts`
- Produces: `StructuredDocumentLayout` mit Markdown-Tabellen-Rekonstruktion und Paragraphenblöcken für tabellarische Mieterlisten, Grundbuchblätter und Klauselstrukturen.

- [ ] **Step 1: Testfall für mehrspaltige Tabellen und Klauselstrukturen (Testfall 08 & Abt. II/III) schreiben**
- [ ] **Step 2: `layout-structure-parser.ts` implementieren (Erkennung von Spaltenrastern und Gliederungsabschnitten)**
- [ ] **Step 3: In `payload-assembler.ts` einbinden, sodass der Unicode-Textlayer mit Block- und Layout-Hierarchien an das VLM übergeben wird**
- [ ] **Step 4: Testlauf (`npx vitest run src/lib/files/layout-structure-parser.test.ts`)**

---

### Task 3: Deterministische Verifikation (Verifiable Rewards / Fact Checks)

**Files:**

- Create: `src/lib/ai/verifiable-fact-checker.ts`
- Modify: `src/lib/ai/pipeline.ts`
- Test: `src/lib/ai/verifiable-fact-checker.test.ts`

**Interfaces:**

- Consumes: `ExtractionStageOutput` aus Step 1
- Produces: `VerificationResult` (validiert, ob Zitate wörtlich im Original vorkommen und mathematische Summen/Raten stimmig sind; setzt andernfalls `NEEDS_REVIEW` mit Begründung)

- [ ] **Step 1: Unit-Tests für Snippet-Existenzprüfung und rechnerische Summenprüfung schreiben**
- [ ] **Step 2: `verifiable-fact-checker.ts` implementieren**
- [ ] **Step 3: In `pipeline.ts` direkt nach Stufe 1 verankern, bevor Stufe 2 startet**
- [ ] **Step 4: Testlauf (`npx vitest run src/lib/ai/verifiable-fact-checker.test.ts`)**

---

### Task 4: Dokumentations-Parität & Quality Gate Check

**Files:**

- Modify: `docs/overview.md`
- Modify: `docs/eval-scaling-plan.md`

- [ ] **Step 1: `docs/overview.md` um die neue Layout-Aware Block-Ingestion und die Verifiable-Fact-Checks in Step 1 ergänzen**
- [ ] **Step 2: Veraltete Modell-Referenzen in allen Dokumenten aktualisieren**
- [ ] **Step 3: `npm run check` und `npm test` ausführen und 100 % grüne Quality Gates nachweisen**
