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

## 3. The Lifecycle Invariant (Standard Industrial Workflow)

The agent operates under a single, non-negotiable invariant: **Default is ALWAYS the Full Engineering Cycle**.

Any modification touching domain models (`src/types/`), API routes (`src/app/api/`), business logic (`src/lib/`), data access, persistence, or infrastructure MUST follow this exact sequence:

1. **Pre-Flight Declaration (Before touching code):**
   - **Scope:** 1–2 sentences on what is being modified.
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
- [x] **Tests & Gates:** (X tests passing, npm run check 0 errors, npm test passing)
- [x] **Impact & Environment Status:** [LOCAL_CODE_ONLY | DECLARATION_STAGED: Artifacts versioned | LIVE_MUTATION_APPLIED: Verified state on remote system]
- [ ] **Explicitly Out-of-Scope:** [Deferred items / next steps]
```

## 5. Discipline & Guardrails

- **Zero Unauthorized Git Commits:** Never run `git commit` or `git push` autonomously. Always present verified changes and await explicit user confirmation.
- **Zero Silent Assumptions:** Never assume the user knows whether an external resource was modified. Always explicitly disclose environment mutations.
- **Guardrails:** No new packages without explicit approval. No `@ts-ignore`, no `eslint-disable`. Fix root causes.
- **Circuit Breaker:** Stop after 3 failed attempts, report trace, await instructions.
- **Discipline & Clarity:** Precise, factual communication without filler.
