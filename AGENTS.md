# System Rules

## 1. Domain & Data Integrity

- **Ground Truth:** Verify dependencies and APIs via codebase (`package.json`, source). Zero unverified assumptions.
- **Traceability:** Audit extractions back to source citations. Never discard provenance metadata.
- **Policy vs. Mechanism:** `src/types/` & `src/lib/dossier/` define technical structure; domain rules, deadlines, and criteria belong exclusively in `src/lib/knowledge/`.
- **Server Confirmation for Critical State:** Audit- and release-critical changes (e.g. dossier status, field validation) require confirmed server persistence (200 OK) before UI confirmation. Show deterministic loading/disabled state during active mutation.
- **Zero-Config Portability:** External services degrade gracefully to bounded local mocks (capped arrays, never unbounded state).

## 2. Architecture & Code Quality

- **Thin Adapters:** UI components and route handlers are pure I/O adapters. Business logic belongs in pure domain modules or hooks.
- **Pure Core Logic:** Deterministic functions, 100% isolated unit testability without runtime mocks.
- **Strict Type Safety & Canonical Models:** `strict: true`, zero `any`, zero unvalidated `as`, zero `!`. All domain models, DTOs, and request payloads are defined exclusively in `src/types/` via Zod schema inference (`export type Foo = z.infer<typeof FooSchema>`). Components and libraries must never declare or export parallel data interfaces or re-export external types. Validate runtime inputs with Zod. Explicit return types on exported functions.
- **Zero Magic Values:** Enforce `as const` dictionaries or Zod enums for domain states and routes. Named constants for numbers.
- **Clean Module Exports:** Explicit named exports only. Wildcard re-exports (`export * from ...`) are prohibited.
- **React 19 & State Hygiene:** Idiomatic React 19 (no manual `useMemo`/`useCallback` unless profiled). Explicit RSC/`'use client'` boundaries. Server state via `@tanstack/react-query` only. Compute derived values during render; push state down to leaf components.
- **Components & Styling:** Max ~200 lines. Use semantic tokens from `globals.css` (no arbitrary hex `#...` or `text-[...]`). Reusable UI primitives use CVA + `cn(...)`.

## 3. Workflow & Verification Gates

1. **Contract First:** Define Zod schemas and TypeScript types first.
2. **TDD:** Write/update failing test, iterate: `npx vitest run <path-to-test>`
3. **Surgical Implementation:** Minimal diff to pass test. Apply the Boy Scout Rule to clean up immediate micro-redundancies in touched code, but avoid unprompted mass refactorings across unrelated files.
4. **Gates:**
   - **Fast Feedback (Iterative):** `npm run check` & `npx vitest run <path-to-test>` for quick turnarounds.
   - **Full Gate (Milestone / PR completion):** `npm run check` (`tsc`, `eslint`, `depcruise`, `audit:magic-strings`, `audit:duplication`), `npm test`, `npm run test:e2e`, and `npm run build`.

## 4. Proactive Opportunity Scan (Mandatory before handoff)

Before declaring any task complete, the agent actively conducts a brief architecture and craftsmanship scan:

- **State Hygiene & Single Source of Truth:** Is there redundant state, duplicate truth across modules, risk of state drift, or uncleaned magic values?
- **Resilience & Concurrency:** Are race conditions, unbounded arrays, or API rate limits guarded against?
- **Notary UX & Value-Add:** What are 2–3 concrete, high-impact optimizations that provide tangible workflow value for the notary practice?

## 5. Discipline & Guardrails

- **Zero Unauthorized Git Commits:** Never run `git commit` or `git push` autonomously. Always present verified changes to the user and wait for explicit confirmation.
- **Guardrails:** No new packages without user confirmation, but **always proactively suggest battle-tested, established ecosystem packages** instead of custom reinventing the wheel (e.g. specialized parsers, standard utilities). No `@ts-ignore`, no `eslint-disable`. Fix root causes.
- **Circuit Breaker:** Stop after 3 failed attempts, report trace, await instructions.
- **Discipline & Clarity:** Concise, factual communication without empty conversational pleasantries. For conceptual, architectural, or strategic questions, provide comprehensive trade-offs and actionable recommendations.
