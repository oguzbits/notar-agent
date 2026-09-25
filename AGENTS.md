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
  - **Fail-Fast Repositories:** Database repositories (`Supabase*`) must throw runtime exceptions on error. No silent swallowing of DB errors and zero fallback state in production code: PostgreSQL is the single source of truth.
- **`src/app/api/` (Thin I/O Adapters):**
  - Route handlers only parse input with Zod, verify server authentication, delegate to `src/lib/`, and format responses.
- **`src/components/` & `src/hooks/` (Presentation & Client State):**
  - React 19 standards: Idiomatic React (no premature `useMemo`/`useCallback`). Explicit RSC/`'use client'` boundaries.
  - Server state is managed exclusively via `@tanstack/react-query`. Client components push state down to leaf components.
- **Conflict Resolution Hierarchy:**
  - **Declarative & Scalable Gold Standards over Imperative Logic (Architecture Invariant):**
    - Substantive domain rules, statutory constraints, audit policies, and evaluation heuristics must NEVER be implemented as imperative, hardcoded `if/else` logic trees or procedural code patches.
    - All policy and business rules MUST follow battle-tested industry gold standards:
      1. **Contract-First Schemas (`src/types/`):** Zod constraints, schema transforms, and strict `as const` disciminators enforce structural validity deterministically at the boundary.
      2. **Declarative Database Knowledge Store (PostgreSQL `knowledge_documents`):** Substantive legal norms, criteria, and triggers live exclusively as declarative data in PostgreSQL, evaluated dynamically via the rule engine/RAG mechanism.
      3. **Constrained & Grounded AI Workflows:** Prompts specify pure task mechanisms, whereas domain constraints and verification logic are injected declaratively from the knowledge base.
  - **Semantic SSOT over File Monoliths:** Single Source of Truth (SSOT) refers to domain authority, not a single physical file. Entity schemas define the data contract SSOT (`src/types/`), domain mutations and calculations reside in pure logic modules (`src/lib/`), and display labels reside in localization modules (`src/lib/.../role-labels.ts`).
  - **Encapsulation (SoC) beats premature DRY:** Structural similarity between independent domains (e.g. route handler boilerplate or auth verification) is preferred over premature, leaky abstractions. Do not couple separate domains just to eliminate duplication.
  - **Pragmatic YAGNI & "Rule of Three":** Do not build speculative abstractions, meta-frameworks, or multi-agent orchestration layers for singular use cases. Implement workflows directly and concretely; only abstract into reusable patterns once at least three distinct domains or use cases demonstrate proven, identical structural needs.
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
7. **Strict Document Portability & Relative Paths (Zero Absolute Environment Leaks):**
   - Documentation files, markdown documents, comments, configuration templates, and repository artifacts MUST NEVER contain machine-specific absolute file URLs or local user home directories (e.g. `file:///Users/...`, `/Users/...`, `C:\Users\...`).
   - Repository-internal links MUST always use standard relative Markdown links (e.g. `[AGENTS.md](AGENTS.md)` or `[Overview](docs/overview.md)`). Absolute machine paths or URI schemes are strictly prohibited to ensure portable, leak-free repositories.
8. **Consolidated Database Migrations (Zero Migration Fragmentation):**
   - Database migrations in `supabase/migrations/` MUST be consolidated into coherent, domain-bounded schema files.
   - Do NOT create fragmented one-line patch migrations or isolated micro-seed files. Schema definitions, policies, indexes, and their corresponding seed knowledge documents belong in their canonical domain migration file (`core`, `knowledge`, `workflows`). New rules or entities should be consolidated into the appropriate domain migration.
9. **Continuous Architecture & Documentation Parity (Zero Stale Docs):**
   - Whenever an architectural change, new subsystem, new schema/contracts domain, or major evaluation pattern is introduced or refactored (e.g. in `src/types/`, `src/lib/`, `config/`), the canonical architecture documentation in `docs/` (specifically `docs/overview.md` and related architecture specs) MUST be kept strictly up to date within the same changeset.
   - Documentation must accurately reflect the codebase's current structure, layer dependencies, contracts, and evaluation mechanisms without outdated or drifting descriptions.
10. **Zero Stale Knowledge & Mandatory Real-Time Verification (Models, APIs & Libraries):**

- Autonomous agents MUST NEVER rely on static, unverified training memory for AI model IDs, API capabilities, deprecation timelines, pricing, or library ecosystems.
- Prior to making architectural decisions, recommending models (e.g. Google Gemini, Anthropic Claude, OpenAI), or modifying AI providers, agents MUST proactively verify the actual current state (e.g. via `search_web` or documentation tools).
- In code, model strings must remain decoupled via configuration schemas (`src/env.ts`, `.env`) and never be hardcoded into business logic.

---

## 3. Design System & UI Standards

- **Primitive First (Zero Ad-Hoc HTML):**
  - Never write raw `<input>`, `<select>`, `<label>`, or custom card wrapper divs in feature views (`src/app/`, `src/components/views/`). Always compose from reusable primitives in `src/components/ui/` (`<Input>`, `<Button>`, `<Card>`, etc.).
- **Base Typography Standard:**
  - Standard scale: All primary body copy, interactive controls, form inputs, and labels MUST default to `text-base` (16px / 1rem minimum).
  - Restricted scale: `text-sm` (14px) is strictly reserved for secondary helper captions, timestamps, and compact table cells. `text-xs` is forbidden for body text and labels (only allowed for compact status pills/badges).
  - Headings must use standard scale (`text-xl`, `text-2xl`, `text-3xl`) with `font-bold` and `tracking-tight`.
- **Strict Semantic Tokens & Automated Enforcement (`@shadcn/lint`):**
  - Never use raw Tailwind palette colors (e.g. `bg-slate-100`, `text-blue-500`) in feature views. Exclusively use semantic theme tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, and `notar-*` accents).
  - Enforced automatically via `@shadcn/lint` (`shadcn/no-raw-colors`, `shadcn/no-restyle`, `shadcn/no-arbitrary-values`, `shadcn/no-inline-styles`, `shadcn/require-static-classes`). Never introduce new raw palette colors or bypass `@/components/ui` primitives.
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
- **Supabase MCP Database Sync:** When a task introduces or modifies database migrations (`supabase/migrations/*.sql`), always inspect the project via the Supabase MCP tools (`apply_migration` / `execute_sql`). Either apply and verify the migration live using Supabase MCP, OR explicitly flag it as an open item in the DoD receipt under `Explicitly Out-of-Scope`. Never leave a database sync implicit or unaddressed.
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
  - _Hard Rule:_ If `DECLARATION_STAGED` is chosen, the remote execution MUST be listed as an open unchecked item `- [ ] Pending Live DB Migration:` under **Explicitly Out-of-Scope**, including the exact migration file and project ref, OR actively executed via Supabase MCP with user confirmation. Never mark a staged migration as complete without flagging the missing live sync.
- [x] **Visual UI Verification:** [NOT_APPLICABLE | VERIFIED via screenshot/inspection]
- [x] **Language & Copywriting:** (100% canonical German notary terminology, zero Denglisch)
- [x] **Architecture & Documentation Parity:** (docs/ and architecture specs updated to match new contracts and subsystems)
- [ ] **Explicitly Out-of-Scope:** [Deferred items / next steps / pending migrations]
```
