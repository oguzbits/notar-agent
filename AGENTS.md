# System Rules & Architectural Invariants

## 1. Architectural Layers & Separation of Concerns (SoC)

The codebase strictly enforces unidirectional data flow and clear execution boundaries:

- **`src/types/` (Pure Contracts & SSOT):**
  - Contains **only** TypeScript types, Zod schemas, and `as const` enums.
  - **Zero implementation logic:** No functions, calculations, state mutations, or UI display strings.
  - Single Source of Truth (SSOT) for data contracts. All models must use Zod schema inference (`z.infer<typeof FooSchema>`).
  - Strict typing: `strict: true`, zero `any`, zero unvalidated `as`, zero double type assertions (`as unknown as`).
- **`src/lib/` (Pure Core Logic & Services):**
  - **Pure domain logic:** Deterministic calculations, status mutations, and business rules belong in pure functions here.
  - **Policy vs. Mechanism (Zero Domain Knowledge in Code):** Technical structures live in `src/lib/dossier/`; technical matching, ranking, and prompt formatting mechanisms live in `src/lib/knowledge/`. Substantive legal rules, guidelines, deadlines, and criteria are strictly domain data and MUST NEVER be hardcoded as static string constants in application code. They reside exclusively in the database knowledge store (PostgreSQL `knowledge_documents` accessed via `IKnowledgeRepository`).
  - **Fail-Fast Repositories:** Database repositories (`Supabase*`) must throw runtime exceptions on error. No silent swallowing of DB errors and zero fallback to transient in-memory state in production code.
- **`src/app/api/` (Thin I/O Adapters):**
  - Route handlers only parse input with Zod, verify server authentication, delegate to `src/lib/`, and format responses.
- **`src/components/` & `src/hooks/` (Presentation & Client State):**
  - React 19 standards: Idiomatic React (no premature `useMemo`/`useCallback`). Explicit RSC/`'use client'` boundaries.
  - Server state is managed exclusively via `@tanstack/react-query`. Client components push state down to leaf components.
- **Conflict Resolution Hierarchy:**
  - **Semantic SSOT over File Monoliths:** Single Source of Truth (SSOT) refers to domain authority, not a single physical file. Entity schemas define the data contract SSOT (`src/types/`), domain mutations and calculations reside in pure logic modules (`src/lib/`), and display labels reside in localization modules (`src/lib/.../role-labels.ts`).
  - **Encapsulation (SoC) beats premature DRY:** Structural similarity between independent domains (e.g. route handler boilerplate or auth verification) is preferred over premature, leaky abstractions. Do not couple separate domains just to eliminate duplication.
  - **Pure Type Invariant (`depcruise`):** `src/types/` must never import implementation logic or functions from `src/lib/`, `src/app/`, or `src/components/`.

---

## 2. Core Invariants (Non-Negotiable)

Every feature and modification must satisfy these technical invariants:

1. **Authentication & Session Identity:**
   - Identity must be resolved server-side from validated cookies/sessions (`@supabase/ssr`). Spoofable client IDs are strictly forbidden.
2. **Database Schema & Kernel-Level RLS:**
   - Complete relational modeling (migrations, foreign keys, cascade rules) with Row-Level Security (`ENABLE ROW LEVEL SECURITY`) enforcing strict tenant isolation (`organization_id`).
   - Filtering, search, and aggregations MUST execute on PostgreSQL (Views, RPC, GIN indices). Streaming entire tables into Node.js application memory is prohibited.
3. **The Complete State Quadrant (No UI Stubs):**
   - Any asynchronous UI component must explicitly handle all 4 states:
     - _Empty State:_ Clear zero-data copy with Call-To-Action (CTA).
     - _Loading State:_ Accessible skeletons or spinners preventing layout shifts (CLS).
     - _Error State:_ Friendly error message with an interactive Retry action.
     - _Pending/Mutating State:_ Disabled controls and loading spinners on buttons to prevent double-submits.
4. **Auditability & Provenance (§ 17 BeurkG):**
   - Critical domain mutations (status overrides, exports, role changes) must be permanently logged in an append-only audit trail with actor, timestamp, reason, and cryptographic hash-chaining.
5. **Zero Hardcoded Data & Domain Knowledge:**
   - Person, team, client, and notary organizational data, as well as substantive legal audit rules and statutory instructions, must never be hardcoded into application source code. All domain knowledge resides exclusively in PostgreSQL (`knowledge_documents` table via database migrations). Test fixtures belong exclusively in isolated test files (`*.test.ts`).
6. **Domain Language & UI Agnosticism:**
   - Technical AI mechanisms (RAG, vector, tokens, embeddings, pipeline stages) must never leak into user-facing UI. User-visible texts must strictly use canonical German notary terminology from `src/lib/dossier/constants.ts`.
   - Legal codes or paragraph references (e.g. § 203 StGB, DSGVO) must not be displayed as decorative marketing slogans in UI headers or badges.

---

## 3. Design System & UI Standards

- **Primitive First (Zero Ad-Hoc HTML):**
  - Never write raw `<input>`, `<select>`, `<label>`, or custom card wrapper divs in feature views (`src/app/`, `src/components/views/`). Always compose from reusable primitives in `src/components/ui/` (`<Input>`, `<Button>`, `<Card>`, etc.).
- **Base Typography Standard:**
  - Standard scale: All primary body copy, interactive controls, form inputs, and labels MUST default to `text-base` (16px / 1rem minimum).
  - Restricted scale: `text-sm` (14px) is strictly reserved for secondary helper captions, timestamps, and compact table cells. `text-xs` is forbidden for body text and labels (only allowed for compact status pills/badges).
  - Headings must use standard scale (`text-xl`, `text-2xl`, `text-3xl`) with `font-bold` and `tracking-tight`.
- **Strict Semantic Tokens:**
  - Never use raw Tailwind palette colors (e.g. `bg-slate-100`, `text-blue-500`) in feature views. Exclusively use semantic theme tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, and `notar-*` accents).
- **Single Source of Action (Anti-Redundancy):**
  - For any distinct user intent within a view, there must exist exactly one canonical trigger. Competing or duplicate interaction paths for the same outcome are prohibited. Dead controls must be purged immediately.

---

## 4. Engineering Workflow & Quality Gates

The default is always the **Full Engineering Cycle**. Any functional change follows this sequence:

### A. Pre-Flight Declaration (Before touching code)

1. **Scope:** 1–2 sentences on what is being modified.
2. **Industry Reference Baseline:** Name 2–3 battle-tested reference standards (e.g. Supabase Dashboard, GitHub Org Settings, Linear, TriNotar, NoRA Advanced) and specify what is adopted.
3. **Architecture & Principles Check:** Verify alignment with layer boundaries and canonical domain language.
4. **Explicitly Out-of-Scope:** What is intentionally deferred.
5. **Impact Level:** `LOCAL_CODE_ONLY` | `DECLARATION_STAGED` | `LIVE_MUTATION_APPLIED`.
6. **Success Criteria:** Exact test command to prove correctness.

_(Fast Path Exception: Pure CSS styling, copy changes in leaf components, or markdown docs bypass Pre-Flight and DoD receipt)._

### B. Execution & Quality Gates

- **Contract First:** Canonical schemas in `src/types/`.
- **TDD:** Write or update a failing test before implementation (`npx vitest run <path>`).
- **Surgical Implementation:** Minimal diff satisfying tests and compiler checks.
- **Quality Gates:** `npm run check` (Type-check, Lint, Depcruise, Knip, Magic Strings, Duplication) and `npm test` passing with 0 errors.
- **Visual Self-Verification:** UI changes must be inspected via headless browser / Playwright to confirm zero CLS and responsive hierarchy before completion.
- **Zero Unauthorized Git Commits:** Never run `git commit` or `git push` autonomously. Always present verified changes and await explicit user confirmation.

### C. Definition of Done (DoD) Receipt

Every functional task concludes with this verified receipt:

```markdown
### 📋 DoD Receipt: [Task Name]

- [x] **Contracts & Types:** (Schemas & types in src/types/...)
- [x] **Industry Reference Baseline:** (Explicit alignment with 2–3 enterprise standards, e.g. GitHub/Supabase/Linear)
- [x] **Endpoints & Persistence:** (Server routes in src/app/api/..., real DB persistence, zero hardcoded mocks)
- [x] **Invariants & Security:** (Server auth validated, RLS tenant isolation, complete 4-state quadrant, audit trail)
- [x] **Design System & A11y:** (Primitives only, semantic theme tokens, base typography, ARIA)
- [x] **Quality Gates & Tests:** (X tests passing, npm run check 0 errors, npm test 100% green)
- [x] **Database Migration & Sync:** [NOT_REQUIRED | DECLARATION_STAGED | LIVE_MUTATION_APPLIED]
- [x] **Visual UI Verification:** [NOT_APPLICABLE | VERIFIED via screenshot/inspection]
- [x] **Language & Copywriting:** (100% canonical German notary terminology, zero Denglisch)
- [ ] **Explicitly Out-of-Scope:** [Deferred items / next steps]
```
