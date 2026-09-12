# System Rules

## 1. Non-Negotiable Invariants

- **Codebase Ground Truth:** Never guess packages, APIs, or architectural decisions. Implementation must be grounded in verified code (`package.json`, source files). If a dependency or symbol is not in the tree, it does NOT exist.
- **Evidence-Based Facts:** High-confidence answers strictly require concrete citations (file path, exact line numbers). Zero unverified assumptions.
- **Traceability & Provenance:** Every transformation and extraction must be auditable back to original inputs or source documents. Never discard origin metadata or citation ranges.
- **YAGNI Over Abstraction:** Favor simple functions and discriminated unions over premature Strategy or Registry patterns. Abstract only when handling 3+ concrete variations.
- **Zero-Config Portability:** External services (DBs, third-party APIs, storage) must gracefully degrade to bounded, leak-free local mocks/stubs (e.g. capped FIFO/LRU arrays, never unbounded global state) when environment variables are unset. Local verification must never fail due to missing remote credentials.

## 2. Modern Tech Invariants

- **React 19 & React Compiler:** Do NOT write manual performance memoization (`useMemo`, `useCallback`, `React.memo`) unless profiling proves a compiler miss. Write idiomatic, clean React 19.
- **Next.js (App Router):** Strict async `params` and `searchParams` handling. Enforce explicit server/client boundaries (RSC by default; `'use client'` only for interactive hooks/browser APIs). Zero legacy Pages Router patterns.
- **Server State via React Query:** Use `@tanstack/react-query` (`useQuery`/`useMutation`) for client-side async server data. Never use manual `useState` + `useEffect` data fetching.
- **State Hygiene:** Never duplicate props or cache derived values in `useState`/`useEffect`; compute derived values synchronously during render. Push state down to leaf components to isolate rerenders.

## 3. Architecture & Clean Code

- **Thin Adapters:** UI components and API routes are pure I/O adapters. Zero business rules, direct DB queries, or imperative DOM mutations (`document.createElement`, `appendChild`) inside them. Extract business rules to pure domain modules or custom hooks; keep React purely declarative.
- **Pure Core Logic:** Domain logic, parsers, and reconcilers must be deterministic, pure functions with 100% isolated unit testability (no framework/runtime mocks).
- **Strict Type Safety:** Absolute end-to-end type safety (`strict: true`). Zero `any`, zero unvalidated `as` casts, zero non-null assertions (`!`). Validate untrusted runtime inputs (API payloads, user inputs, forms) strictly via Zod.
- **Explicit Export Types:** Enforce explicit return types on all exported functions, services, and route handlers.
- **Immutability & Resilience:** Never mutate state or arguments in-place. Zero silent error swallowing (`catch {}`); provide actionable error context. Wrap route segments and async boundary components in Error Boundaries or `error.tsx`.
- **Component Sizing & Styling (ShadCN/CVA Invariant):** Keep components under ~200 lines (excluding declarative configs/schemas and tests). Never use arbitrary hardcoded hex codes (`#B9ED94`) or ad-hoc Tailwind values (`text-[11px]`, `bg-[#...]`) anywhere in `src/`. Use semantic design tokens from `globals.css` and standard utility classes. Domain modules in `src/lib/` must never contain UI CSS classes or color hexes. Reusable UI primitives in `src/components/ui/` must follow the declarative CVA pattern: Base-Styles + Variant/Size-Maps, merged deterministically via `cn(...)` from `@/lib/utils` (zero raw template strings). Ensure accessibility (semantic HTML, visible focus states, ARIA states on custom disclosures).
- **Zero Magic Strings & States:** Domain states, UI routes, and status filters must never be raw magic strings. Enforce typed `as const` dictionaries or Zod enums (e.g. `CASE_STATUS.DRAFT_READY`, `VIEW_MODE.UPLOAD`) with derived types. Magic numbers must be declared as named constants.

## 4. Guardrails (Zero-Laziness)

- ❌ **Forbidden:** Installing dependencies (`npm i <pkg>`) without explicit user permission $\rightarrow$ **Required:** Zero new packages. Use native Web APIs (`fetch`, `crypto`, `URL`) and existing workspace tools.
- ❌ **Forbidden:** Modifying files blindly without reading existing context $\rightarrow$ **Required:** Locate targets via precise grep/file search before generating diffs.
- ❌ **Forbidden:** Business logic in UI event handlers or route handlers $\rightarrow$ **Required:** Extract to domain functions or service hooks.
- ❌ **Forbidden:** Skipping tests or marking changes "trivial" $\rightarrow$ **Required:** Targeted test-driven verification for every logic change.
- ❌ **Forbidden:** Suppressing type/linter issues (`@ts-ignore`, `eslint-disable`) $\rightarrow$ **Required:** Fix the underlying schema or type mismatch.
- ❌ **Forbidden:** Scope creep, bulk formatting, or altering untouched files/comments $\rightarrow$ **Required:** Minimal, surgical diffs. Keep existing comments and docstrings intact.

## 5. Execution Workflow & Efficiency

Mandatory sequence for code modifications (read-only queries bypass directly):

1. **Targeted Locate:** Find relevant code using exact pattern search. Read only the target lines/files.
2. **Contract First:** Define interfaces and Zod schemas before writing business logic.
3. **Fast TDD Cycle:** Write or update a failing test, then iterate against _only_ that target test file:
   `npx vitest run <path-to-test>`
4. **Surgical Implementation:** Implement the minimal code necessary to satisfy the test and contracts.
5. **Gatekeeper Check:** Run quick static checks before final validation:
   `npx tsc --noEmit`
6. **Final Verification:** Run `npm test` and `npm run build`. Provide concise terminal evidence and stop immediately.

## 6. Verification Commands & Error Budget

One-shot commands only (no background watchers):

- `npx vitest run <path-to-test>` — Fast feedback during active iteration.
- `npx tsc --noEmit` — Instant type-check gate (run before full build).
- `npm test` — One-shot full test suite.
- `npm run lint` — ESLint verification.
- `npm run build` — Production build check (run at final completion).
- **Circuit Breaker:** If a test or build error cannot be resolved within **3 iterations**, stop immediately. Output the exact error trace, state what was attempted, and await instructions. Do not loop endlessly.
- **Output Discipline:** Terminal evidence only. No conversational pleasantries or restatements of code changes.
