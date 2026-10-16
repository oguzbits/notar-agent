# Observability (Zyklus 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fehler, Stage-Laufzeiten und Erreichbarkeit sichtbar machen, ohne Fallinhalte an einen Dienst zu senden.

**Architecture:** Reine Funktionen in `src/lib/observability/` (Logger, Scrubber), Schema in `src/types/observability.ts`. Sentry wird nur in den Next-Einstiegsdateien verdrahtet und ruft den Scrubber auf. Health ist ein dünner Adapter.

**Tech Stack:** Next 16, `@sentry/nextjs` (Version vorher mit `npm view` prüfen), Zod 4, Vitest.

**Spec:** [2026-10-16-observability-design.md](../specs/2026-10-16-observability-design.md)

## Global Constraints

- Sentry nur mit EU-DSN (`o<id>.ingest.de.sentry.io`) und nur bei gesetztem `SENTRY_DSN`; ohne DSN kein `Sentry.init`.
- `dataCollection`: alle Inhaltsfelder aus (`userInfo`, `cookies`, `httpHeaders`, `httpBodies: []`, `urlQueryParams`, `genAI`, `databaseQueryData`, `stackFrameVariables`).
- Logs und Events enthalten nur: Fehlerklasse, Route, `jobId`/`organizationId`, Stage, Dauer, Modell, Ergebnis. Kein Freitext, keine Fehlerobjekte.
- Kein `@ai-sdk/otel`, kein Token-Logging (Zyklus 2).
- `src/types/` ohne Logik; Konfiguration nur über `src/env.ts`.
- Commits klein, ohne `--no-verify`; Trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Fehler mit Dateiinhalt in der Meldung (`new Error("Vertrag Müller…")`): Meldung darf nicht ins Event/Log gelangen.
- Event ohne Stacktrace oder ohne Request: Scrubber darf nicht werfen.
- Health bei geworfener DB-Ausnahme (nicht nur Fehlerantwort): 503, kein Text.
- Logger mit `undefined`-Feldern (kein `jobId`): Zeile bleibt gültiges JSON.
- Stage-Fehler: Dauer wird trotzdem geloggt, Fehler wird weitergeworfen.

---

### Task 1: Log-Schema, Logger und Scrubber

**Files:**

- Create: `src/types/observability.ts`, `src/lib/observability/logger.ts`, `src/lib/observability/scrub-event.ts`
- Test: `src/lib/observability/logger.test.ts`, `src/lib/observability/scrub-event.test.ts`

**Interfaces:**

- Produces (`src/types/observability.ts`): `LOG_LEVELS = ['info','warn','error'] as const`, `LOG_OUTCOMES = ['ok','fehler'] as const`, `LogEventSchema` (strict Zod-Objekt: `level`, `event: string`, `stage?: string`, `durationMs?: number`, `model?: string`, `jobId?: string`, `organizationId?: string`, `outcome?`, `errorClass?: string`), `type LogEvent`.
- Produces (`logger.ts`): `logEvent(event: LogEvent): void` schreibt `JSON.stringify` einer Zeile nach `console.info|warn|error` je Level; `errorClassOf(err: unknown): string` liefert `err.constructor.name` bzw. `'UnbekannterFehler'`; `async function timed<T>(base: Omit<LogEvent,'durationMs'|'outcome'|'level'>, fn: () => Promise<T>): Promise<T>` misst Dauer, loggt `ok` (info) oder `fehler` (error, mit `errorClass`) und wirft Fehler weiter.
- Produces (`scrub-event.ts`): `scrubEvent<E extends ErrorEvent>(event: E): E` mit `ErrorEvent` aus `@sentry/core` (Typ-Import). Behält `exception.values[].type`, Stacktrace-Frames ohne `vars`, `request.url` ohne Query, `tags.job_id`, `tags.organization_id`; entfernt alles andere (Meldungstext, `request.data|cookies|headers`, `user`, `extra`, `contexts`, `breadcrumbs`). `scrubBreadcrumb(): null`.

- [ ] **Step 1: Failing tests schreiben.** `scrub-event.test.ts`: (a) Event mit `request.data`, Cookie, `user.email`, `extra`, `message`, Frame-`vars` → Ergebnis enthält nichts davon; (b) behält `type`, `job_id`, `organization_id`, URL ohne Query; (c) Event ohne `exception`/`request` wirft nicht; (d) `exception.values[0].value` ("Vertrag Müller") fehlt. `logger.test.ts`: (a) unbekanntes Feld wird von `LogEventSchema.strict()` abgelehnt; (b) Zeile ohne `jobId` ist gültiges JSON ohne Schlüssel `jobId`; (c) `timed` bei Erfolg: ein Info-Log mit `durationMs >= 0`, `outcome: 'ok'`; (d) `timed` bei Wurf: ein Error-Log mit `errorClass`, Fehlertext nicht im Log, Fehler wird erneut geworfen.
- [ ] **Step 2:** `npx vitest run src/lib/observability` → FAIL (Module fehlen).
- [ ] **Step 3: Implementieren** wie in Interfaces. Zod-Schema in `types`, Logik in `lib`.
- [ ] **Step 4:** `npx vitest run src/lib/observability` → PASS. Schutztest: Scrubber-Aufruf testweise zum Identitätsfunktion machen → Tests (a)/(d) werden rot; danach zurücknehmen.
- [ ] **Step 5: Commit** `feat(observability): Log-Schema, Logger und Scrubber`.

### Task 2: Pipeline und API-Routen auf Logger umstellen

**Files:**

- Modify: `src/lib/ai/pipeline.ts` (`runExtractionStage` ab Z. 142 mit `generateText` Z. 178 und Reflexions-`console.warn` Z. 251; `runAuditorStage` ab Z. 314 mit `generateText` Z. 403), `src/app/api/analyze/route.ts` (Z. 93, 189, 222, 293), `src/app/api/jobs/route.ts` (Z. 32, 74), `src/lib/supabase/server-auth.ts` (Z. 16, 38)
- Test: `src/lib/ai/pipeline.test.ts` (bestehende Datei erweitern; falls sie anders heißt, die Pipeline-Tests dort)

**Interfaces:**

- Consumes: `logEvent`, `timed`, `errorClassOf` aus Task 1.
- Produces: Stage-Events `event: 'pipeline_stage'`, `stage: 'extraktion' | 'pruefung'`, `model` aus dem Modellparameter, optional `jobId`.

- [ ] **Step 1: Failing Test:** Pipeline-Lauf mit gemocktem Modell loggt je Stage genau ein `pipeline_stage`-Ereignis mit `outcome: 'ok'`; ein werfendes Modell erzeugt `outcome: 'fehler'` und die Funktion wirft weiter.
- [ ] **Step 2:** Test ausführen → FAIL.
- [ ] **Step 3:** Beide `generateText`-Aufrufe in `timed(...)` einhüllen. Jede `console.*`-Stelle durch `logEvent({ level, event, errorClass: errorClassOf(err) })` ersetzen; keine Fehlerobjekte oder Meldungstexte mehr ausgeben. `jobId` nur durchreichen, wo er an der Stelle schon vorliegt.
- [ ] **Step 4:** `npx vitest run src/lib/ai src/app/api` → PASS; `grep -rn "console\." src/lib/ai/pipeline.ts src/app/api/analyze src/app/api/jobs src/lib/supabase/server-auth.ts` → keine Treffer.
- [ ] **Step 5: Commit** `refactor(observability): Pipeline und Routen loggen strukturiert`.

### Task 3: Health-Endpunkt

**Files:**

- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Interfaces:**

- Consumes: Admin-Client aus `src/lib/supabase/admin.ts` (Export vorher lesen).
- Produces: `export const dynamic = 'force-dynamic'`; `GET(): Promise<Response>` → `{ status: 'ok' }` mit 200 oder `{ status: 'fehler' }` mit 503, sonst nichts im Body.

- [ ] **Step 1: Failing Tests:** (a) DB-Abfrage ok → 200 `{status:'ok'}`; (b) DB liefert Fehlerantwort → 503; (c) DB-Client wirft → 503; (d) Body enthält in (b)/(c) keinen Fehlertext; (e) fehlende Konfiguration (kein Service-Key) → 503.
- [ ] **Step 2:** `npx vitest run src/app/api/health` → FAIL.
- [ ] **Step 3:** Route implementieren: leichte Abfrage (z. B. `select` mit `limit(1)` auf `organizations`), `try/catch` um alles, Fehler nur über `logEvent` mit `errorClass`.
- [ ] **Step 4:** Tests → PASS. Prüfen, dass die Middleware `/api/health` ohne Login durchlässt (`src/lib/supabase/middleware.ts`); falls nicht, Ausnahme dort mit Test ergänzen.
- [ ] **Step 5: Commit** `feat(observability): Health-Endpunkt`.

### Task 4: Sentry einbinden

**Files:**

- Modify: `package.json`, `next.config.ts` (`withSentryConfig`), `src/env.ts` (`SENTRY_DSN: optionalTrimmedString`), `src/app/global-error.tsx` (`Sentry.captureException` ergänzen, ohne UI-Änderung)
- Create: `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/lib/observability/sentry-options.ts`
- Test: `src/lib/observability/sentry-options.test.ts`

**Interfaces:**

- Produces: `buildSentryOptions(dsn: string | undefined): SentryOptions | null` (`null` ohne DSN). Mit DSN: `{ dsn, dataCollection: {…laut Global Constraints}, beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb, tracesSampleRate: 0 }`. Die Einstiegsdateien rufen `Sentry.init` nur auf, wenn das Ergebnis nicht `null` ist. `instrumentation.ts` exportiert `onRequestError = Sentry.captureRequestError`.

- [ ] **Step 1:** `npm view @sentry/nextjs version peerDependencies` prüfen; installieren; Optionsnamen (`dataCollection`) gegen die installierten Typen prüfen. Weicht der Name ab, Spec anpassen.
- [ ] **Step 2: Failing Tests:** `buildSentryOptions(undefined)` → `null`; mit DSN: `dataCollection.httpBodies` ist `[]`, `userInfo`/`cookies`/`httpHeaders`/`genAI`-Felder sind aus, `beforeSend === scrubEvent`; DSN ohne `.ingest.de.sentry.io` → wirft (EU-Zwang).
- [ ] **Step 3:** Implementieren und verdrahten. `SENTRY_DSN` in `.env.example` ergänzen (leer).
- [ ] **Step 4:** `npx vitest run src/lib/observability` → PASS; `npm run build` ohne gesetzten DSN läuft durch.
- [ ] **Step 5: Commit** `feat(observability): Sentry EU mit Scrubber`.

### Task 5: Doku und Gesamtprüfung

**Files:**

- Modify: `docs/overview.md`, `ROADMAP.md`, `CHANGELOG.md`, `BACKLOG.md` (§3 auf Reststand kürzen: Token-Telemetrie entfällt, Verweis auf Zyklus 2)

- [ ] **Step 1:** Doku im Stil der vorhandenen Einträge aktualisieren (Schicht `observability`, Datenfluss, Verzicht auf OTel). Keine Aufgabenlisten in `docs/`.
- [ ] **Step 2:** `npm run check && npm test` → 0 Fehler, Score ≥ 90.
- [ ] **Step 3: Commit** `docs(observability): Architektur, Roadmap und Changelog`.
- [ ] **Step 4:** Offen im Abschlussbericht melden: Sentry-Konto/DSN, AVV, Logstream der Hosting-Plattform.
