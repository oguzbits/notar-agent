# System Rules

## 1. Domain & Data Integrity

- **Production-Ready & Vertical Slice Invariant (No UI Stubs):** Every functional feature must be fully integrated from the database layer through the server endpoints (`src/app/api/`) down to the UI. Ephemeral client-only mocks or state simulating persistence via `localStorage` or component state are strictly forbidden for completed features.
- **Zero Hardcoded Data:** Person, team, employee, client, and notary organizational data must never be hardcoded into application source code (`src/components/`, `src/providers/`, `src/lib/`). Test fixtures belong exclusively in isolated test files (`*.test.ts`) or in database seed scripts (`seed.sql`).
- **Ground Truth:** Verify dependencies and APIs via codebase (`package.json`, source). Zero unverified assumptions.
- **Traceability:** Audit extractions back to source citations. Never discard provenance metadata.
- **Policy vs. Mechanism:** `src/types/` & `src/lib/dossier/` define technical structure; domain rules, deadlines, and criteria belong exclusively in `src/lib/knowledge/`.
- **Domain Language & UI Agnosticism:** Technical AI/system mechanisms (e.g. RAG, vector, embeddings, prompt, tokens, pipeline stages) must never leak into user-facing UI, prompts, or audit records. User-visible status messages, activity texts, and headers must be defined strictly via canonical domain constants in `src/lib/dossier/constants.ts` using German notary practice terminology. Inline, ad-hoc status strings are prohibited.
- **Zero Legal Statute Slogans in UI:** User interfaces must never display legal codes, paragraph references (e.g. § 203 StGB, DSGVO), or redundant compliance slogans in headings, helper texts, or security badges. Professional confidentiality and legal compliance are technical architectural invariants, not decorative marketing copy in the UI.
- **Server Confirmation for Critical State:** Audit- and release-critical changes require confirmed server persistence (200 OK) before UI confirmation. Show deterministic loading/disabled state during active mutation.
- **Zero-Config Portability:** External services degrade gracefully to bounded local mocks (capped arrays, never unbounded state).
- **Database-First Architecture & Zero In-Memory Streaming:** Filtering, text search, vector matching, and aggregations MUST execute on the database engine (PostgreSQL RPC, Views, GIN/HNSW indices). Streaming entire tables or unindexed datasets into Node.js application memory is strictly prohibited.

## 2. Architecture & Code Quality

- **Thin Adapters:** UI components and route handlers are pure I/O adapters. Business logic belongs in pure domain modules or hooks.
- **Pure Core Logic:** Deterministic functions, 100% isolated unit testability without runtime mocks.
- **Strict Type Safety & Canonical Models:** `strict: true`, zero `any`, zero unvalidated `as`, zero `!`. All domain models, DTOs, and request payloads are defined exclusively in `src/types/` via Zod schema inference (`export type Foo = z.infer<typeof FooSchema>`). Components and libraries must never declare or export parallel data interfaces or re-export external types. Validate runtime inputs with Zod. Explicit return types on exported functions.
- **Zero Magic Values:** Enforce `as const` dictionaries or Zod enums for domain states and routes. Named constants for numbers.
- **Clean Module Exports:** Explicit named exports only. Wildcard re-exports (`export * from ...`) are prohibited.
- **React 19 & State Hygiene:** Idiomatic React 19 (no manual `useMemo`/`useCallback` unless profiled). Explicit RSC/`'use client'` boundaries. Server state via `@tanstack/react-query` only. Compute derived values during render; push state down to leaf components.
- **Components & Styling:** Max ~200 lines. Use semantic tokens from `globals.css` (no arbitrary hex `#...` or `text-[...]`). Reusable UI primitives use CVA + `cn(...)`.
- **Design System & Typography Invariant (No Ad-Hoc HTML Primitives):**
  - **Primitive First (Zero Ad-Hoc HTML):** In feature views (`src/app/`, `src/components/views/`), never write raw `<input>`, `<select>`, `<label>`, or custom card wrapper divs. Always compose from reusable primitives in `src/components/ui/` (`<Input>`, `<Button>`, `<Card>`, `<CardHeader>`, etc.).
  - **Base Typography Standard:** All primary human-readable content, interactive controls, form inputs, and labels MUST default to `text-base` (16px / 1rem minimum).
  - **Restricted Scale:** `text-sm` (14px) is strictly reserved for secondary helper captions, timestamps, and compact table cells. `text-xs` is strictly forbidden for body, form fields, and labels; it is only permitted for compact status pills/badges. Headings MUST use standard scale (`text-xl`, `text-2xl`, `text-3xl`) with `font-bold` and `tracking-tight`.
  - **Strict Semantic Tokens:** Never use raw Tailwind palette colors (e.g. `bg-slate-100`, `text-blue-500`, `border-gray-200`) in feature views. Exclusively use semantic theme tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, and `notar-*` accents).

## 3. The Lifecycle Invariant (Standard Industrial Workflow)

The agent operates under a single, non-negotiable invariant: **Default is ALWAYS the Full Engineering Cycle**.

Any modification touching domain models (`src/types/`), API routes (`src/app/api/`), business logic (`src/lib/`), data access, persistence, or infrastructure MUST follow this exact sequence:

1. **Pre-Flight Declaration (Before touching code):**
   - **Scope:** 1–2 sentences on what is being modified.
   - **Architecture & Principles Check:** Verify alignment with core constraints (execution boundaries, separation of concerns, canonical domain language).
   - **Explicitly Out-of-Scope:** What is intentionally deferred.
   - **Impact Level:**
     - `LOCAL_CODE_ONLY`: Local logic, types, in-memory stubs only.
     - `DECLARATION_STAGED`: Declarative artifacts created/staged (schemas, configs, migrations), zero live mutation.
     - `LIVE_MUTATION_APPLIED`: Live environment or shared service mutated (DB, Auth, Storage, Env). Requires verified status check.
   - **Success Criteria:** Exact test command or query to prove correctness.
2. **Contract First:** Canonical Zod schemas and TypeScript types in `src/types/`.
3. **TDD:** Write/update failing unit or integration test before implementing (`npx vitest run <path>`).
4. **Surgical Implementation:** Minimal diff to satisfy tests and type checks.
5. **Quality Gates:** `npm run check` and `npm test` passing with 0 errors.
6. **Mandatory DoD Receipt:** Deliver the standardized receipt before declaring completion.

### The ONLY Permitted Exception (Fast Path):

Pure presentational CSS/styling (`src/app/globals.css`, `src/components/ui/*`), text copywriting in leaf components, or markdown documentation. In this case alone, upfront declaration and DoD receipt are bypassed in favor of instant execution and a 1-line verification confirmation.

## 4. Definition of Done (DoD) Receipt

No functional task is complete without this verified receipt:

```markdown
### 📋 DoD Receipt: [Task Name]

- [x] **Contracts & Types:** (Schemas & types in src/types/...)
- [x] **Endpoints & Persistence:** (Server routes in src/app/api/..., real DB persistence, zero hardcoded mocks in app code)
- [x] **Architecture & Consistency:** (Verified architectural fit, appropriate execution boundaries, canonical domain language enforced)
- [x] **Tests & Gates:** (X tests passing, npm run check 0 errors, npm test passing)
- [x] **Impact & Environment Status:** [LOCAL_CODE_ONLY | DECLARATION_STAGED: Artifacts versioned (Agent MUST actively prompt user whether to apply live) | LIVE_MUTATION_APPLIED: Verified state on remote system]
- [x] **Data Readiness & Seeding:** [NOT_REQUIRED | SEEDED: Details | STAGED_IN_ROADMAP: Reference to task]
- [ ] **Explicitly Out-of-Scope:** [Deferred items / next steps]
```

## 5. Discipline & Guardrails

- **Zero Unauthorized Git Commits:** Never run `git commit` or `git push` autonomously. Always present verified changes and await explicit user confirmation.
- **Zero Silent Assumptions:** Never assume the user knows whether an external resource was modified. Always explicitly disclose environment mutations.
- **Guardrails:** No new packages without explicit approval. No `@ts-ignore`, no `eslint-disable`. Fix root causes.
- **Circuit Breaker:** Stop after 3 failed attempts, report trace, await instructions.
- **Discipline & Clarity:** Precise, factual communication without filler.
