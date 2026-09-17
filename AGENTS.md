# System Rules

## 1. Domain & Data Integrity

- **Production-Ready & Vertical Slice Invariant (No UI Stubs):** Every functional feature must be fully integrated from the database layer through the server endpoints (`src/app/api/`) down to the UI. Ephemeral client-only mocks or state simulating persistence via `localStorage` or component state are strictly forbidden for completed features.
- **The 6-Dimensional Production-Ready Invariant (Industrial Standard):**
  No feature or plan is production-ready unless all 6 dimensions are explicitly designed, implemented, and verified:
  1. **Authentication & Session Identity:** Zero spoofable client IDs. Every server action and route handler resolves identity from validated server cookies/sessions (`@supabase/ssr`). Dynamic organization and user context must flow deterministically.
  2. **Database Schema & Kernel-Level RLS:** Complete relational modeling (migrations, foreign keys, cascade rules, partial indices) paired with hermetic PostgreSQL Row-Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) enforcing tenant isolation (§ 203 StGB).
  3. **Deterministic Error, Loading & Empty States:** Explicit handling of all edge states (400, 401, 403, 404, 409, 500, network timeouts). Zero unhandled UI flashes, white screens, or silent failures. All mutating controls must display pending/disabled states with clear user feedback.
  4. **Auditability & Provenance (§ 17 BeurkG):** Critical business actions (status overrides, exports, role changes) must be permanently recorded in an append-only audit trail with actor identification, timestamp, reason, and cryptographic integrity verification.
  5. **Design System & Accessible UI Standards:** 100% adherence to reusable primitives in `src/components/ui/`, semantic theme tokens (`bg-background`, `text-foreground`, `notar-*`), typography scale (`text-base` standard, `text-sm` captions only, zero `text-xs` in body/labels), responsive layouts (mobile to desktop), and full keyboard/screenreader accessibility (ARIA attributes, proper focus management).
  6. **Comprehensive Automated Test Coverage (TDD):** Domain logic, Zod validation schemas, API route handlers, and failure modes covered with isolated unit and integration tests (`npm test` 100% green). UI interactions covered with realistic Playwright E2E smoke tests.
- **Zero Hardcoded Data:** Person, team, employee, client, and notary organizational data must never be hardcoded into application source code (`src/components/`, `src/providers/`, `src/lib/`). Test fixtures belong exclusively in isolated test files (`*.test.ts`) or in database seed scripts (`seed.sql`).
- **Ground Truth:** Verify dependencies and APIs via codebase (`package.json`, source). Zero unverified assumptions.
- **Traceability:** Audit extractions back to source citations. Never discard provenance metadata.
- **Policy vs. Mechanism:** `src/types/` & `src/lib/dossier/` define technical structure; domain rules, deadlines, and criteria belong exclusively in `src/lib/knowledge/`.
- **Domain Language & UI Agnosticism:** Technical AI/system mechanisms (e.g. RAG, vector, embeddings, prompt, tokens, pipeline stages) must never leak into user-facing UI, prompts, or audit records. User-visible status messages, activity texts, and headers must be defined strictly via canonical domain constants in `src/lib/dossier/constants.ts` using German notary practice terminology. Inline, ad-hoc status strings are prohibited.
- **Zero Legal Statute Slogans in UI:** User interfaces must never display legal codes, paragraph references (e.g. § 203 StGB, DSGVO), or redundant compliance slogans in headings, helper texts, or security badges. Professional confidentiality and legal compliance are technical architectural invariants, not decorative marketing copy in the UI.
- **Server Confirmation for Critical State:** Audit- and release-critical changes require confirmed server persistence (200 OK) before UI confirmation. Show deterministic loading/disabled state during active mutation.
- **Zero-Config Portability:** External services degrade gracefully to bounded local mocks (capped arrays, never unbounded state).
- **Database-First Architecture & Zero In-Memory Streaming:** Filtering, text search, vector matching, and aggregations MUST execute on the database engine (PostgreSQL RPC, Views, GIN/HNSW indices). Streaming entire tables or unindexed datasets into Node.js application memory is strictly prohibited.
- **The One-Shot Production Invariants (Zero Follow-Up Required):**
  To guarantee complete, reliable single-turn implementations, every feature modification MUST satisfy:
  1. **Full Wiring & No-Orphan-Code Invariant:** Features must be completely wired end-to-end. Unconnected route handlers, unmounted UI modals, missing TanStack Query cache invalidations, or uninvoked database mutations are considered fatal defects. The entire data lifecycle (Fetch $\rightarrow$ Cache $\rightarrow$ Mutate $\rightarrow$ Invalidate $\rightarrow$ Render) must be active and tested.
  2. **The Complete State Quadrant:** Any UI view or component consuming or mutating asynchronous state MUST implement all 4 states explicitly:
     - _Empty State:_ Meaningful zero-data illustration/copy with clear Call-To-Action (CTA).
     - _Loading State:_ Accessible skeletons or spinners preventing layout shifts (CLS).
     - _Error State:_ User-friendly error message with an interactive Retry action.
     - _Pending/Mutating State:_ Disabled controls, loading spinners on active buttons, and prevention of double-submits.
  3. **Fail-Fast Database Boundary (Zero Silent Fallbacks):** Production repositories (`Supabase*`) must never silently swallow database errors or fallback to transient in-memory arrays. Runtime database exceptions must fail fast (`throw new Error`), triggering retries or error boundaries. In-memory implementations are strictly reserved for isolated unit tests or explicit local demo configurations.
  4. **One-Shot Verification Proof:** Before declaring completion, the agent must prove functionality by executing automated checks and providing verified evidence (successful API route tests with 200/400/403/500 coverage, `npm run check`, and `npm test` 100% green).

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
   - **Industry Reference Baseline (Zero Blind Reinvention):** Name and analyze 2–3 battle-tested reference standards tailored to the specific problem domain:
     - _For horizontal SaaS infrastructure_ (Team management, Auth, Billing, Webhooks, API keys): Benchmark against enterprise gold standards (e.g. Supabase Dashboard, GitHub Org Settings, Linear, Stripe, Vercel).
     - _For vertical notary/legal domain workflows_ (Urkundenverwaltung, Fristen, Beteiligte, Aktenführung, XJustiz-Export): Benchmark against premier LegalTech & Kanzleisoftware standards (e.g. TriNotar, NoRA Advanced, Notar 4.0, RA-MICRO, Harvey AI).
       Explicitly state which data models, UX workflows, and safeguards are adopted from these benchmarks.
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
- [x] **Industry Reference Baseline:** (Explicit alignment with 2–3 enterprise standards, e.g. GitHub/Supabase/Linear)
- [x] **Endpoints & Persistence:** (Server routes in src/app/api/..., real DB persistence, zero hardcoded mocks in app code)
- [x] **6-Dimensional Production-Readiness Check:**
  - [x] 1. Auth & Session (Server-validated identity, zero spoofable IDs)
  - [x] 2. DB Schema & RLS (Kernel-level isolation, migrations versioned)
  - [x] 3. Error & Loading States (Deterministic pending/disabled/error handling)
  - [x] 4. Audit & Provenance (Audit trail event recorded where applicable)
  - [x] 5. Design System & A11y (Primitives only, semantic tokens, base typography, ARIA)
  - [x] 6. Tests & Gates (Unit/Integration tests passing, zero lint/type errors)
- [x] **Architecture & Consistency:** (Verified architectural fit, appropriate execution boundaries, canonical domain language enforced)
- [x] **Tests & Gates:** (X tests passing, npm run check 0 errors, npm test passing)
- [x] **Database Migration & Supabase Sync:**
  - Status: [NOT_REQUIRED | DECLARATION_STAGED: `supabase/migrations/YYYYMMDD_name.sql` versioned | LIVE_MUTATION_APPLIED: Migration applied to Supabase project]
  - Action Required: (If DECLARATION_STAGED, Agent MUST explicitly ask the user whether to run/apply the migration to Supabase now)
- [x] **Visual UI Verification (Live UI Invariant):** [NOT_APPLICABLE (Backend/Logic only) | VERIFIED: Headless browser screenshot/render inspection proving zero CLS, correct responsive layout, and accessible interaction]
- [x] **Language & Copywriting Check:** (100% pure German terminology, zero Denglisch, canonical notary terms from `constants.ts`)
- [ ] **Explicitly Out-of-Scope:** [Deferred items / next steps]
```

## 5. Discipline & Guardrails

- **Language & Communication Standard (Zero Denglisch):** All explanations, commit descriptions, UI copywriting, button labels, and system status messages MUST be written in clear, precise German. Technical Anglizismen (e.g. "Data fetching layer", "Single Source of Truth", "Pending state") must be translated into accurate domain language (z. B. "Datenabruf-Schicht", "Zentrale Datenquelle", "Schwebender Zustand"). User-visible texts must strictly use canonical terms from `src/lib/dossier/constants.ts`.
- **Visual Self-Verification Standard (Live UI Invariant):** Whenever modifying or adding user interfaces (`src/components/`, `src/app/`), the agent must never declare completion blindly. The agent is required to verify rendering visually via headless browser / Playwright execution and embed evidence (screenshot/walkthrough) confirming zero layout shifts and proper responsive hierarchy.
- **Zero Unauthorized Git Commits:** Never run `git commit` or `git push` autonomously. Always present verified changes and await explicit user confirmation.
- **Zero Silent Assumptions:** Never assume the user knows whether an external resource was modified. Always explicitly disclose environment mutations.
- **Guardrails:** No new packages without explicit approval. No `@ts-ignore`, no `eslint-disable`. Fix root causes.
- **Circuit Breaker:** Stop after 3 failed attempts, report trace, await instructions.
- **Discipline & Clarity:** Precise, factual communication without filler.
