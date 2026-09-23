# Notar Agent – Technische Features & Agentic Software Engineering Setup

Dieses Dokument beschreibt die Implementierungsdetails der **technischen Kern-Features** von **Notar Agent** sowie das dahinterliegende **Agentic Software Engineering Setup** (Entwicklungsregeln, Best-Practice-Mapping, Safety-Hooks, Skills, MCP und deterministische Quality Gates).

---

## 1. Technische Kern-Features & Systemarchitektur

Notar Agent folgt einem strikt unidirektionalen Datenfluss mit klarer Schichtentrennung (Separation of Concerns):

```
┌────────────────────────────────────────────────────────┐
│                   src/types/                           │
│  Pure Contracts, Zod Schemas & as const Enums (SSOT)   │
└──────────────────────────┬─────────────────────────────┘
                           │ (Contracts & Schemas)
┌──────────────────────────▼─────────────────────────────┐
│                    src/lib/                            │
│  Pure Domain Logic, AI Workflows & Repositories        │
│  (Keine UI-Imports, deterministische Berechnungen)     │
└─────────────┬────────────────────────────┬─────────────┘
              │ (Data & Services)          │ (Domain Logic)
┌─────────────▼──────────────┐ ┌───────────▼─────────────┐
│       src/app/api/         │ │  src/components/ & hooks│
│ Thin I/O Route Handlers    │ │  React 19, Server State │
│ Auth, Zod Validation, SSE  │ │  TanStack Query, UI     │
└────────────────────────────┘ └─────────────────────────┘
```

### 1.1 Schichtenarchitektur im Detail

- **[`src/types/`](../src/types/) (Pure Contracts & SSOT):** Ausschließlich TypeScript-Typen, Zod-Schemas und `as const`-Enums. Null Implementierungslogik, Berechnungen oder UI-Strings. Typen werden stets via `z.infer<typeof Schema>` abgeleitet (siehe z. B. [`src/types/dossier.ts`](../src/types/dossier.ts), [`src/types/jobs.ts`](../src/types/jobs.ts), [`src/types/audit.ts`](../src/types/audit.ts)).
- **[`src/lib/`](../src/lib/) (Pure Core Logic & Services):** Deterministische Domänen-Berechnungen, Reifegrad-Algorithmen ([`src/lib/dossier/readiness.ts`](../src/lib/dossier/readiness.ts)), Status-Mutationen und AI-Pipelines ([`src/lib/ai/pipeline.ts`](../src/lib/ai/pipeline.ts), [`src/lib/workflow/orchestrator.ts`](../src/lib/workflow/orchestrator.ts)). Repositories ([`src/lib/supabase/repository.ts`](../src/lib/supabase/repository.ts)) folgen einem Fail-Fast-Muster und werfen sofort Ausnahmen.
- **[`src/app/api/`](../src/app/api/) (Thin I/O Adapters):** Route Handlers parsen Payloads via Zod ([`src/app/api/analyze/route.ts`](../src/app/api/analyze/route.ts), [`src/app/api/documents/route.ts`](../src/app/api/documents/route.ts)), prüfen Server-Auth ([`src/lib/supabase/server-auth.ts`](../src/lib/supabase/server-auth.ts)), delegieren an `src/lib/` und formatieren Responses bzw. SSE-Streams.
- **[`src/components/`](../src/components/) & [`src/hooks/`](../src/hooks/) (Präsentation & Client-State):** React 19 Komponenten mit klaren RSC/`'use client'`-Grenzen ([`src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx`](../src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx)). Server-State wird über TanStack Query verwaltet ([`src/hooks/useDocuments.ts`](../src/hooks/useDocuments.ts), [`src/hooks/useJobs.ts`](../src/hooks/useJobs.ts)); asynchrone Komponenten erzwingen den 4-Status-Quadranten (_Empty_, _Loading_, _Error_, _Mutating_).

### 1.2 Dual-Stream Ingestion & Normalisierung ([`src/lib/files/`](../src/lib/files/))

- **PDF-Stream-Introspektion ([`src/lib/files/pdf-stream-classifier.ts`](../src/lib/files/pdf-stream-classifier.ts)):** Eingehende Dokumente werden auf Byte-Ebene klassifiziert:
  - _Digital-Born PDFs:_ Verlustfreie Unicode-Textextraktion (< 10 ms) für exakte Ziffernfolgen (`1.250.000 €`, Grundbuchblätter, Flurstücke) ohne OCR-Fehlinterpretationen ([`src/lib/files/pdf-text-extractor.ts`](../src/lib/files/pdf-text-extractor.ts)).
  - _Scans / Bildträger:_ Multimodales Vision-Routing (`@ai-sdk/anthropic`, `@ai-sdk/google`) für Siegel, handschriftliche Änderungen und Stempel.
  - _Hybride Dokumente:_ Parallele Übergabe von digitalem Textlayer und Bild-Payloads an das Modell (Dual-Stream Fusion).
- **Triage & MIME-Validierung ([`src/lib/files/document-triage.ts`](../src/lib/files/document-triage.ts), [`src/lib/files/file-types.ts`](../src/lib/files/file-types.ts)):** Vorverarbeitung, Bereinigung und Typisierung vor dem eigentlichen Modellaufruf.

### 1.3 Multimodaler agentischer Analyse-Workflow ([`src/app/api/analyze/`](../src/app/api/analyze/), [`src/lib/ai/`](../src/lib/ai/))

- **Echtzeit-SSE-Streaming ([`src/lib/sse/create-sse-stream.ts`](../src/lib/sse/create-sse-stream.ts), [`src/lib/sse/parse-sse-stream.ts`](../src/lib/sse/parse-sse-stream.ts)):** Fortschritts-Updates und Stufenwechsel werden in Echtzeit an den Client gestreamt.
- **Pipeline-Stufen ([`src/lib/ai/pipeline.ts`](../src/lib/ai/pipeline.ts)):**
  1. _Ingestion & Normalisierung:_ Standardisierung von Upload-Payloads ([`src/lib/ai/payload-assembler.ts`](../src/lib/ai/payload-assembler.ts)).
  2. _Multimodale Extraktion:_ Strukturierte Objekterkennung mit Zod-Schema über das Vercel AI SDK (`ai`).
  3. _Reconciliation & Konsistenzabgleich:_ [`src/lib/ai/dossier-merger.ts`](../src/lib/ai/dossier-merger.ts) und [`src/lib/dossier/entity-reconciliation.ts`](../src/lib/dossier/entity-reconciliation.ts) isolieren divergierende Angaben (z. B. Kaufpreis im Exposé vs. Entwurf) mit lückenloser Historie.
  4. _Reifegrad-Ermittlung:_ [`src/lib/dossier/readiness.ts`](../src/lib/dossier/readiness.ts) bewertet den Bearbeitungsstand über 4 Reifegrad-Stufen bis zur Beurkundungsreife.

### 1.4 Asynchrone Großakten-Verarbeitung & Job-Engine ([`src/lib/jobs/`](../src/lib/jobs/), [`src/lib/workflow/`](../src/lib/workflow/))

- **PostgreSQL Job-Queue (`dossier_jobs`):**
  - Entkoppelt rechenintensive Großakten (50–200 Seiten) vom HTTP-Request (`202 Accepted` in < 250 ms), um 504-Gateway-Timeouts zu verhindern.
  - Transaktionssichere Job-Vergabe via `SELECT ... FOR UPDATE SKIP LOCKED` mit Concurrency-Limiting (`p-limit`, max. 2 parallele Läufe) gegen Provider-Rate-Limits (429) ([`src/lib/jobs/job-worker.ts`](../src/lib/jobs/job-worker.ts), [`src/lib/jobs/job-repository.ts`](../src/lib/jobs/job-repository.ts)).
  - Robustes Worker-Lifecycle-Management mit automatischem Orphan-Recovery und Retry-Mechanismen ([`src/lib/jobs/job-daemon.ts`](../src/lib/jobs/job-daemon.ts)).
- **Workflow-Orchestrator ([`src/lib/workflow/orchestrator.ts`](../src/lib/workflow/orchestrator.ts), [`src/lib/workflow/engine.ts`](../src/lib/workflow/engine.ts)):**
  - Deterministischer Zustandsautomat für mehrstufige Workflows mit Rollenprüfung ([`src/lib/workflow/default-workflows.ts`](../src/lib/workflow/default-workflows.ts)).
  - Hält an Human-in-the-Loop Gates (z. B. Freigabe durch den Notar) automatisch an.

### 1.5 Revisionssicherer Audit-Trail (§ 17 BeurkG) ([`src/lib/audit/`](../src/lib/audit/))

- Jede Statusänderung, Freigabe oder manuelle Übersteuerung wird im `audit_logs`-Schema dokumentiert ([`src/lib/audit/audit-repository.ts`](../src/lib/audit/audit-repository.ts)).
- **Kryptographisches Hash-Chaining ([`src/lib/audit/audit-crypto.ts`](../src/lib/audit/audit-crypto.ts)):** Jeder Log-Eintrag verknüpft den vorherigen Hash (`previous_hash`) mit dem aktuellen Zustandshash (`current_hash`, SHA-256) zu einer manipulationsresistenten Kette.

### 1.6 RLS-gestützte Multi-Tenancy & Knowledge Store (PostgreSQL 17)

- **Kernel-Level Isolation:** PostgreSQL Row-Level Security (`ENABLE ROW LEVEL SECURITY`) auf allen Tabellen ([`supabase/migrations/`](../supabase/migrations/)) bindet Daten strikt an `organization_id`.
- **Database-First SSOT:** Materielle Rechtsnormen (BGB, BeurkG, GEG) und Kanzleistandards liegen in `knowledge_documents` und werden dynamisch über [`src/lib/knowledge/rules/rule-selector.ts`](../src/lib/knowledge/rules/rule-selector.ts) in Prompts injiziert – der Anwendungscode bleibt frei von statischen Gesetzes-Strings.

### 1.7 Authentische Real-World Testakten & Model-Evaluation ([`test-akten/`](../test-akten/), `promptfoo`)

- **Synthetische, datenschutzkonforme Referenzakten ([`test-akten/README.md`](../test-akten/README.md)):**
  - Eigene, realistisch generierte Testfälle ohne echte Mandantendaten (§ 203 StGB), die exakte Herausforderungen der notariellen Praxis nachbilden:
    - _Fall 01 (Multimodalitäts-Stresstest):_ Verwackelte vs. scharfe Personalausweis-Scans (erzwingt ehrliches `NEEDS_REVIEW` ohne Halluzinationen).
    - _Fall 02 (Unvollständige Urkunde):_ Fehlende Grundbuchseiten für Abt. I Eigentümer (erzwingt § 21 BeurkG Sperre).
    - _Fall 03 (Handschriftliche Korrektur):_ Notarieller Scan mit handschriftlicher Rand-Kaufpreisänderung (425.000 € statt 450.000 €).
    - _Fall 05 & 06 (GEG-Energieausweise):_ Offizielle Bundesmuster-Formulare zur Prüfung von Kennwerten und abgelaufenen Fristen (§ 80 GEG).
    - _Fall 08 (MFH-Mieterlisten):_ Komplexe 30-Einheiten-Liste mit gedruckten und handschriftlich ergänzten Mietparteien zur mathematischen Summenprüfung.
  - Alle Testdateien können deterministisch über Generatorskripte in `scripts/fixtures/` neu gerendert werden.
- **Automatisierte Evaluation mit Promptfoo ([`config/promptfoo.yaml`](../config/promptfoo.yaml)):**
  - Ermöglicht quantitative Messungen der Modellgüte gegen definierte Ground-Truth-Daten ([`src/test/eval/golden-dataset.ts`](../src/test/eval/golden-dataset.ts), [`src/test/eval/scorer.ts`](../src/test/eval/scorer.ts)).
  - Misst Extraktionsgenauigkeit, Token-Verbrauch und Latenzen über `npm run eval:smoke` und `npm run eval:live` im visuellen Browser-Dashboard (`npm run eval:view`).

---

## 2. Das Agentic Software Engineering Setup

Notar Agent wird konsequent nach dem Prinzip des **Agentic Software Engineering** entwickelt: Autonome KI-Entwicklungsagenten operieren innerhalb eines rigiden Leitplankensystems aus Systemregeln, Safety-Hooks, Skills und deterministischen Quality Gates.

```
┌──────────────────────────────────────────────────────────┐
│                   Entwicklungs-Agent                     │
└────────────────────────────┬─────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│  AGENTS.md   │     │ Safety Hooks │     │ Custom Skills  │
│ System Rules │     │ (.agents/    │     │ (.agents/      │
│ & Invariants │     │  hooks.json) │     │  skills/...)   │
└──────────────┘     └───────┬──────┘     └────────────────┘
                             │ Validierung vor/nach Tools
                             ▼
┌──────────────────────────────────────────────────────────┐
│             Deterministische Quality Gates               │
│ npm run check: tsc, eslint, depcruise, knip, audits      │
└──────────────────────────────────────────────────────────┘
```

### 2.1 Best-Practice-Mapping: Prinzipien & Regeln vs. Tooling

Klassische Software-Engineering-Prinzipien dürfen in der agentischen Entwicklung keine unverbindlichen Appelle bleiben. Sie werden durch konkrete Regeln und automatisierte Werkzeuge operationalisiert:

| Best Practice / Paradigma                  | Kernherausforderung mit LLM-Agenten                                                                                                                                 | Konkretes Feature & Regel-Enforcement im Setup                                                                                                                                                                                                                                            |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSOT (Single Source of Truth)**          | Agenten erfinden Duplikat-Typen, parallele Interfaces oder raw String-Unions, die nach wenigen Commits auseinanderdriften.                                          | **[`src/types/`](../src/types/) als strikter Vertrag:** Zod-Schema-Inferenz (`z.infer`), `as const` Dictionaries + dynamisches `npm run audit:magic-strings`. Keine Paralleltypen.                                                                                                        |
| **SoC (Separation of Concerns)**           | Agenten packen Geschäftslogik in Next.js Route-Handler, React-Hooks oder UI-Komponenten (fat components).                                                           | **Harte Dependency-Cruiser-Regeln ([`config/dependency-cruiser.js`](../config/dependency-cruiser.js)):** `domain-must-not-depend-on-ui`, `pure-types-must-not-depend-on-implementation`. Kompilierfehler bei Grenzverletzungen.                                                           |
| **SSOT vs. SoC Balancing**                 | _Dilemma:_ Packt man Schema, Mutation und UI-Labels in eine Datei (Monolith), verletzt man SoC. Trennt man alles naiv, entstehen inkonsistente Duplikate.           | **Semantische SSOT über Domänenautorität:** Geteilte Semantik statt File-Monolithen: Verträge ([`src/types/`](../src/types/)), Berechnungen ([`src/lib/`](../src/lib/)), UI-Labels ([`src/lib/auth/role-labels.ts`](../src/lib/auth/role-labels.ts)).                                     |
| **YAGNI & Abstraktionshygiene**            | LLMs neigen bei agentischen Workflows zu spekulativer Überabstraktion (komplexe Meta-Orchestrierungs-Frameworks oder verfrühte Klassenhierarchien für Einzelfälle). | **Architektur-Regel in [`AGENTS.md`](../AGENTS.md): Keine Meta-Frameworks + "Rule of Three":** Workflows werden direkt und konkret implementiert. Abstraktion erfolgt erst ab 3 identischen Anwendungsfällen. Ergänzend detektiert **`knip`** ungenutzte Exporte, Typen und Dependencies. |
| **DRY vs. Premature Abstraction**          | Agenten abstrahieren strukturell ähnlichen, aber fachlich unabhängigen Code voreilig („Wiederholungs-Panik“) und schaffen toxische Kopplung.                        | **[`AGENTS.md`](../AGENTS.md) Richtlinie:** _„Encapsulation (SoC) beats premature DRY“_ + `jscpd` Audit mit 2 % Schwelle: Echte Code-Duplikate werden abgewehrt, fachliche Isolation bleibt gewahrt.                                                                                      |
| **Clean Code & Purity**                    | Seiteneffekte in Domänenfunktionen erschweren Unit-Tests; Vermischung von Gesetzen mit Code führt zu statischem Ballast.                                            | **Policy vs. Mechanism:** Rechner, Parser und Workflow-Engines sind reine, deterministische Funktionen. Materielles Kanzleiwissen liegt in PostgreSQL (`knowledge_documents`).                                                                                                            |
| **Fail-Fast & Zero UI Stubs**              | Agenten fangen Fehler stillschweigend ab (`try { ... } catch {}`), geben leere Daten zurück oder lassen UI-Ladezustände unfertig.                                   | **Supabase Repositories werfen sofort Exceptions;** Die UI erzwingt den **Complete State Quadrant** (Empty, Loading, Error, Mutating).                                                                                                                                                    |
| **TDD (Test-Driven Development)**          | Agenten schreiben Code „ins Blaue“ und behaupten Vollzug ohne Nachweis.                                                                                             | **`test-driven-development` Skill & Husky Pre-Push:** 292 automatisierte Vitest-Tests müssen vor jedem Push zu 100 % grün sein.                                                                                                                                                           |
| **Least Privilege & Blast Radius Control** | Ein autonomes Modell könnte ungewollt `git push`, destruktive Löschbefehle oder Secret-Exposures ausführen.                                                         | **[`.agents/hooks.json`](../.agents/hooks.json) (Command- & File-Safety-Guards):** Physisches Abfangen destruktiver Kommandos und Blockieren von Secrets vor Tool-Ausführung.                                                                                                             |

### 2.2 Die Systemverfassung: `AGENTS.md`

Die Datei [`AGENTS.md`](../AGENTS.md) definiert verbindliche Richtlinien für jeden Agenten:

- **Pre-Flight Declaration:** Vor jedem funktionalen Eingriff deklariert der Agent Scope, Referenz-Standards, Invarianten-Check und Testkriterien.
- **Semantic SSOT over File Monoliths:** Geteilte Semantik statt Code-Monolithen (Trennung von Vertrag, Domain und Label).
- **Pragmatisches YAGNI & „Rule of Three“:** Verbot spekulativer Meta-Abstraktionen für Workflows. Konkrete Implementierungen schlagen verfrühte Abstraktionsschichten.
- **Encapsulation (SoC) schlägt verfrühtes DRY:** Ähnlicher Boilerplate zwischen unabhängigen Adaptern ist besser als künstliche Kopplung.
- **Keine eigenständigen Git-Commits:** Agenten führen niemals autonom `git commit` oder `git push` aus.
- **Definition of Done (DoD) Quittung:** Formelle Verifikation nach jedem Feature vor Abschluss.

### 2.3 Agentic Safety-Hooks ([`.agents/hooks.json`](../.agents/hooks.json))

Automatisierte Pre-Tool- und Post-Tool-Lifecycle-Hooks sichern das System gegen Fehlbedienungen ab:

- **`command-safety-guard` ([`.agents/scripts/guard-command.js`](../.agents/scripts/guard-command.js)):** Blockiert unautorisierte `git commit`/`push`, destruktive `rm -rf`-Befehle und versehentlichen Zugriff auf `.env`-Dateien.
- **`file-safety-guard` ([`.agents/scripts/guard-file.js`](../.agents/scripts/guard-file.js)):** Verhindert das Überschreiben geschützter Systemdateien und Kernarchitektur-Konfigurationen ohne Bestätigung.
- **`stop-verification-gate` ([`.agents/scripts/guard-stop.js`](../.agents/scripts/guard-stop.js)):** Verhindert den Abschluss von Agentenläufen, falls noch offene Kompilier- oder Testfehler vorliegen.

### 2.4 Workspace-Skills & MCP-Server

- **Skills ([`.agents/skills/`](../.agents/skills/)):**
  - **`notar-workflow-validator` ([`.agents/skills/notar-workflow-validator/SKILL.md`](../.agents/skills/notar-workflow-validator/SKILL.md)):** Prüft Schema-Parität der 10 Pflichtfelder über alle Schichten ([`src/types/dossier.ts`](../src/types/dossier.ts), [`src/lib/ai/prompts.ts`](../src/lib/ai/prompts.ts), Cockpit-UI) und garantiert lückenlose Belege (`fileName`, `snippet`, `pageNumber`).
  - **`software-craftsmanship`:** Erzwingt Single Source of Truth, Null-Magie-Werte und Zustandshygiene.
  - **`test-driven-development`:** Leitet Implementierungen über fehlschlagende Tests an (Red-Green-Refactor).
- **MCP-Server Integration:**
  - **`supabase` MCP:** Schema-Inspektion, SQL-Abfragen und Live-Migrationsausführung (`apply_migration`).
  - **`context7` MCP:** Semantische Dokumentationsrecherche für Bibliotheken und SDKs.
  - **`chrome-devtools` MCP:** Headless-Browser-Inspektion zur Überprüfung barrierefreier Hierarchien (A11y) und CLS-Vermeidung.

### 2.5 Deterministische Quality-Gates & Tooling

Alle Änderungen durchlaufen den zentralen Prüfbefehl `npm run check`:

- **Dependency Cruiser (`npm run depcruise`):** Verhindert verbotene Importe zwischen Domäne, UI und Typen sowie zirkuläre Abhängigkeiten ([`config/dependency-cruiser.js`](../config/dependency-cruiser.js)).
- **Knip (`npm run knip`):** Erkennt ungenutzte Exporte, Typen, Dateien und Dependencies (YAGNI).
- **Code Duplication Guard (`jscpd`):** Deckt redundante Code-Duplikate in `src/` ab einem Schwellenwert von 2 % auf (`npm run audit:duplication`).
- **Magic String Audit (`audit:magic-strings`):** Stellt sicher, dass Statuswerte niemals als rohe String-Literale im Code verwendet werden ([`scripts/audit/audit-magic-strings.mjs`](../scripts/audit/audit-magic-strings.mjs)).
- **Strict TypeScript & Linting:** `strict: true`, `noUncheckedIndexedAccess: true` ([`tsconfig.json`](../tsconfig.json)) sowie `@shadcn/lint` für semantische UI-Primitives.
- **Git Hooks (Husky):** Automatisches `npm run check` und `lint-staged` bei Pre-Commit ([`.husky/pre-commit`](../.husky/pre-commit)) sowie `npm test` bei Pre-Push ([`.husky/pre-push`](../.husky/pre-push)).
