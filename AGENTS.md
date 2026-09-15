# System Rules

## 1. Domain & Data Integrity

- **Ground Truth:** Verify dependencies and APIs via codebase (`package.json`, source). Zero unverified assumptions.
- **Traceability:** Audit extractions back to source citations. Never discard provenance metadata.
- **Policy vs. Mechanism:** `src/types/` & `src/lib/dossier/` define technical structure; domain rules, deadlines, and criteria belong exclusively in `src/lib/knowledge/`.
- **Server Confirmation for Critical State:** Audit- and release-critical changes require confirmed server persistence (200 OK) before UI confirmation. Show deterministic loading/disabled state during active mutation.
- **Zero-Config Portability:** External services degrade gracefully to bounded local mocks (capped arrays, never unbounded state).

## 2. Architecture & Code Quality

- **Thin Adapters:** UI components and route handlers are pure I/O adapters. Business logic belongs in pure domain modules or hooks.
- **Pure Core Logic:** Deterministic functions, 100% isolated unit testability without runtime mocks.
- **Strict Type Safety & Canonical Models:** `strict: true`, zero `any`, zero unvalidated `as`, zero `!`. All domain models, DTOs, and request payloads are defined exclusively in `src/types/` via Zod schema inference (`export type Foo = z.infer<typeof FooSchema>`). Components and libraries must never declare or export parallel data interfaces or re-export external types. Validate runtime inputs with Zod. Explicit return types on exported functions.
- **Zero Magic Values:** Enforce `as const` dictionaries or Zod enums for domain states and routes. Named constants for numbers.
- **Clean Module Exports:** Explicit named exports only. Wildcard re-exports (`export * from ...`) are prohibited.
- **React 19 & State Hygiene:** Idiomatic React 19 (no manual `useMemo`/`useCallback` unless profiled). Explicit RSC/`'use client'` boundaries. Server state via `@tanstack/react-query` only. Compute derived values during render; push state down to leaf components.
- **Components & Styling:** Max ~200 lines. Use semantic tokens from `globals.css` (no arbitrary hex `#...` or `text-[...]`). Reusable UI primitives use CVA + `cn(...)`.

## 3. Tiered Workflow: Fast Path vs. Standard Path

To maximize velocity while guaranteeing systemic integrity, tasks follow a deterministic 2-tier model:

### Tier A: Fast Path (Micro-Tasks & Pure UI Tweaks)

- **Eligibility Trigger:** Task touches only local UI presentation, copy, style tokens, or isolated local bugfixes without touching schemas, contracts, APIs, or persistent state (`LOCAL_CODE_ONLY`).
- **Workflow:**
  - **No upfront briefing required.** Proceed directly to implementation.
  - Fast feedback loop: run relevant test and `npm run check`.
  - **Completion:** A concise 1-line status report confirming verified behavior and green checks.

### Tier B: Standard Path (Features, Contracts, State & Infrastructure)

- **Eligibility Trigger:** Any task introducing/modifying types/schemas in `src/types/`, API route contracts, shared business logic, database migrations, authentication, external services, or environment configuration (`DECLARATION_STAGED` or `LIVE_MUTATION_APPLIED`).
- **Workflow:**
  1. **Upfront Task Briefing (2–3 sentences before code edits):**
     - **Goal & In-Scope:** What is being built and modified?
     - **Explicitly Out-of-Scope:** What is intentionally deferred?
     - **Target Impact Classification:**
       - `LOCAL_CODE_ONLY`: Internal domain logic, pure functions, contract schemas, in-memory mocks.
       - `DECLARATION_STAGED`: Declarative artifacts prepared (e.g. schemas, configuration templates, migration files, API specifications), zero remote changes.
       - `LIVE_MUTATION_APPLIED`: Active remote or shared environment touched (e.g. cloud database, auth directory, storage buckets, queues, environment variables).
     - **Proof of Success:** Specific test command, static check, or query to prove the target state.
  2. **Contract First:** Define Zod schemas and TypeScript types in `src/types/`.
  3. **TDD:** Write/update failing test, iterate: `npx vitest run <path-to-test>`.
  4. **Surgical Implementation:** Minimal diff to satisfy tests.
  5. **Verification Gates:**
     - Fast feedback: `npm run check` & `npx vitest run <path-to-test>`.
     - Full Gate: `npm run check`, `npm test`, `npm run test:e2e`, and `npm run build`.

## 4. Definition of Done (DoD) & Standardized Receipt

No stateful or architectural task is complete merely because code compiles. For any Tier B task, the agent must output a standardized DoD receipt prior to declaring completion:

### Tier B DoD Criteria:

- **Base (All Tier B Tasks):**
  - [x] Canonical contracts & types in `src/types/`, 0 type errors (`tsc --noEmit`), 0 magic values.
  - [x] 100% isolated unit/integration tests green (`npx vitest run ...`).
  - [x] `npm run check` and `npm test` passing with 0 errors.
- **When `DECLARATION_STAGED`:**
  - [x] Declarative artifacts complete, versioned, and statically validated.
  - [x] Zero uncommitted or unintended side-effects on remote environments.
- **When `LIVE_MUTATION_APPLIED`:**
  - [x] Mutation executed on target environment via authorized tooling.
  - [x] Target state (e.g. entity existence, access policies, security flags) explicitly verified and logged in the receipt.
  - [x] Zero drift between local declarative artifacts and live environment state.

### Standardized Receipt Format (Tier B Only):

```markdown
### 📋 DoD Receipt: [Task Name]

- [x] **Contracts & Types:** (Schemas & types in src/types/...)
- [x] **Tests & Gates:** (X tests passing, npm run check 0 errors, npm test passing)
- [x] **Environment & Impact Status:** [e.g. "LOCAL_CODE_ONLY" OR "DECLARATION_STAGED: Artifacts versioned" OR "LIVE_MUTATION_APPLIED: Resource X updated, verified state Y"]
- [ ] **Explicitly Out-of-Scope:** [What was intentionally deferred]
```

## 5. Proactive Opportunity Scan (Prior to Handoff)

Before finalizing, quickly assess:

- **State Hygiene & Single Source of Truth:** Any duplicated state, twin truths, or raw magic values?
- **Resilience & Concurrency:** Are race conditions, unbounded arrays, or rate limits protected?
- **Notary UX & Value-Add:** 1–2 pragmatic optimizations providing immediate notary value?

## 6. Discipline & Guardrails

- **Zero Unauthorized Git Commits:** Never run `git commit` or `git push` autonomously. Always present verified changes and await explicit user confirmation.
- **Zero Silent Assumptions:** Never assume the user knows whether an external resource was modified. Always explicitly disclose environment mutations.
- **Guardrails:** No new packages without explicit approval. No `@ts-ignore`, no `eslint-disable`. Fix root causes.
- **Circuit Breaker:** Stop after 3 failed attempts, report trace, await instructions.
- **Discipline & Clarity:** Precise, factual communication without filler.
