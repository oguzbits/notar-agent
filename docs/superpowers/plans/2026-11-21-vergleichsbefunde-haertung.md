# Härtung aus dem Projektvergleich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Die Befunde des Vergleichs mit `ticketmaster` und `notebooklm-klon` umsetzen, die weder einen anderen Supabase-Plan noch eine Migration brauchen.

**Architecture:** Kleine, voneinander unabhängige Änderungen an Route, Proxy, Logger, CI und Doku. Keine neue Tabelle, keine neue Abhängigkeit.

**Tech Stack:** Next.js 16 (`proxy.ts`), Vitest, Zod, GitHub Actions, Stryker.

**Spec:** Vergleichsbericht dieser Sitzung; ROADMAP C.7 (Request-Kennung), AGENTS.md Invarianten 8 und 9.

## Global Constraints

- Keine Migration, kein Eingriff in Live-Systeme (Impact: `LOCAL_CODE_ONLY`).
- Logformat bleibt `LogEventSchema` (`.strict()`, keine Freitexte); Sentry nur Allowlist-Tags.
- Deutsche Fachsprache in nutzersichtbaren Texten; keine absoluten Pfade in Dateien.
- Jeder Test einer Schutzfunktion muss ohne die Schutzfunktion rot werden.

## Review Focus

- Idempotency-Key einer fremden Kanzlei (Kollision auf der Job-ID): Antwort 409, kein Leck des fremden Jobs.
- Zwei gleichzeitige Anfragen mit demselben Schlüssel: genau ein Job, genau ein Worker.
- Wiederholung mit gleichem Schlüssel verbraucht kein Stundenkontingent und startet keinen zweiten Lauf.
- Vom Client gelieferte `x-request-id` mit Steuerzeichen oder Überlänge wird verworfen und ersetzt (Log-Injection).
- Unbekannte Kennung außerhalb eines Requests (Worker, Cron): Logzeile ohne `requestId`, kein Fehler.

---

## Nicht Teil dieses Plans (mit Grund)

- **Staging, Backups, Alarmierung:** brauchen Pro-Plan bzw. externes Konto.
- **Embedding-Modell-Schutz (`embedding_model` je Dokument):** braucht eine Spalte, also Migration; wird mit B.8.13 gebündelt.
- **Quellen-Viewer (Spec `2026-10-17-originale-je-vorgang-design.md`):** neue Tabelle `dossier_files`, rechtliche Aufbewahrung offen.
- **Zitat-Rückmeldung im Cockpit:** Befund war falsch; `verifiable-fact-checker.ts` schreibt den Grund bereits in `note`, das Cockpit zeigt sie.
- **Job-Queue-Wechsel, Frage an die Akte:** abhängig von B.9 bzw. vom Viewer.

### Task 1: Idempotenz für Hintergrund-Analysen

**Files:**

- Modify: `src/app/api/analyze/route.ts`, `src/lib/jobs/job-repository.ts`, die Stelle im Client, die `?async=true` aufruft (per Grep auf `async=true`/`x-async-mode` unter `src/hooks`, `src/components`)
- Test: `src/app/api/analyze/route.test.ts` (neu oder bestehende Datei erweitern), `src/lib/jobs/job-repository.test.ts`

**Interfaces:**

- Entscheidung: Der Header `Idempotency-Key` (UUID) ist die Job-ID. `jobs.id` ist `TEXT PRIMARY KEY`, daher keine Migration.
- Produces: `createJob(payload: CreateJobPayload, organizationId?: string, jobId?: string): Promise<{ job: DossierJob; created: boolean }>` in `IJobRepository`. Bei PK-Verletzung (SQLSTATE `23505`) wird der vorhandene Job der eigenen Kanzlei zurückgegeben (`created: false`); gehört die ID einer fremden Kanzlei (nicht lesbar), wirft die Methode `JobIdConflictError`.
- Route: Ungültiger Schlüssel (kein UUID) → 400. `created: false` → 202 mit vorhandenem Job, kein `after()`, vorher keine Kontingentprüfung verbrauchen (Nachschlagen vor der Kontingentprüfung). `JobIdConflictError` → 409.

- [ ] **Step 1: Tests schreiben (rot)** — Repository: gleiche ID zweimal liefert `created: false` und denselben Job; fremde Kanzlei → `JobIdConflictError`. Route: zweiter Aufruf mit gleichem Schlüssel startet `executeDossierJob` nicht erneut und zählt nicht ins Kontingent; Nicht-UUID → 400; ohne Header unverändertes Verhalten.
- [ ] **Step 2: Rot bestätigen** — `npx vitest run src/app/api/analyze src/lib/jobs/job-repository.test.ts`
- [ ] **Step 3: Umsetzen** — `createJob` mit optionaler ID und 23505-Behandlung; Route liest Header; Client erzeugt je Absenden einen `crypto.randomUUID()` und sendet ihn mit.
- [ ] **Step 4: Gegenprobe** — 23505-Zweig und Kontingent-Vorabprüfung kurz entfernen, Tests werden rot, wiederherstellen.
- [ ] **Step 5: Grün + Commit** — `npx vitest run <Pfade>`, danach `feat(analyze): Idempotency-Key für Hintergrund-Analysen`.

### Task 2: Request-Kennung in Antwort, Logs und Sentry

**Files:**

- Modify: `src/proxy.ts`, `src/types/observability.ts`, `src/lib/observability/logger.ts`, `src/lib/observability/scrub-event.ts`, `src/instrumentation.ts`, `src/app/api/analyze/route.ts` (nur Übergabe)
- Create: `src/lib/observability/request-id.ts`
- Test: `src/lib/observability/request-id.test.ts`, `logger.test.ts`, `scrub-event.test.ts`, `src/proxy.test.ts`

**Interfaces:**

- Produces: `REQUEST_ID_HEADER = 'x-request-id'`; `resolveRequestId(incoming: string | null | undefined): string` — übernimmt `^[A-Za-z0-9_-]{8,64}$`, sonst `crypto.randomUUID()`.
- `LogEvent.requestId?: string` (optional, im strikten Schema); `logFailure(level, event, err, requestId?: string)`.
- `ALLOWED_TAGS` um `request_id` erweitert; `onRequestError` setzt den Tag aus `request.headers` und ruft danach `Sentry.captureRequestError`.
- Proxy setzt die Kennung auf Request-Header (für Routen) und Response-Header.

- [ ] **Step 1: Tests (rot)** — `resolveRequestId`: gültig bleibt, `"a\nb"`, Überlänge, leer, `null` werden ersetzt; Logger gibt `requestId` aus und lehnt Freitext-Felder weiter ab; `scrubEvent` behält `request_id` und verwirft andere Tags; Proxy-Antwort trägt den Header.
- [ ] **Step 2: Rot bestätigen** — `npx vitest run src/lib/observability src/proxy.test.ts`
- [ ] **Step 3: Umsetzen** wie in Interfaces; `analyze/route.ts` übergibt `req.headers.get('x-request-id')` an seine `logFailure`-Aufrufe.
- [ ] **Step 4: Handprobe** — `npm run dev`, `curl -i localhost:3000/api/health` zeigt `x-request-id`; mit eigenem gültigen Header wird er zurückgegeben.
- [ ] **Step 5: Commit** — `feat(observability): x-request-id in Antwort, Logs und Sentry-Tags`; ROADMAP C.7 Punkt abhaken und CHANGELOG ergänzen.

### Task 3: Architekturentscheidungen (ADR) und Bedrohungsmodell

**Files:**

- Create: `docs/adr/0001-…md` bis `0006-…md`, `docs/adr/README.md` (Index), `docs/security/threat-model.md`

**Interfaces:** Front matter mit `covers:` wie in den vorhandenen Specs (siehe `scripts/audit/audit-docs.mjs`); Aufbau je ADR: Kontext, Entscheidung, Folgen, Verworfene Alternativen; keine Aufgabenlisten.

- [ ] **Step 1:** Format von `audit:docs` und `audit:docs:drift` lesen und bestehende Spec-Front-Matter übernehmen.
- [ ] **Step 2: ADRs aus belegten Entscheidungen** — (1) `after()` statt Dauer-Worker, (2) drei konsolidierte Migrationen, (3) Ganzakte im Kontext statt Retrieval über die Akte, (4) Regeln als Daten in `knowledge_documents`, (5) Hash-Kette in der Datenbank, (6) Idempotenz über Job-ID. Jede Aussage mit Datei- oder Doku-Beleg; keine erfundenen Begründungen.
- [ ] **Step 3: Bedrohungsmodell** — Vermögenswerte, Vertrauensgrenzen, Angriffsflächen (Upload, Prompt-Injection über Dokumente, Mandantenübergriff, Demo-Missbrauch, Kostenmissbrauch), vorhandene Gegenmaßnahmen mit Fundstelle, offene Punkte aus ROADMAP/BACKLOG.
- [ ] **Step 4:** `npm run audit:docs` grün; Commit `docs(adr): Entscheidungsverzeichnis und Bedrohungsmodell`.

### Task 4: Mutationstests wöchentlich in CI

**Files:**

- Modify: `stryker.config.json`, `config/vitest.mutation.config.mts`, `package.json` (nur falls Skript nötig)
- Create: `.github/workflows/mutation.yml`

**Interfaces:** `mutate` um reine Kernmodule erweitern (`src/lib/dossier/state.ts`, `src/lib/auth/rbac.ts`, `src/lib/audit/override-audit.ts`), dazugehörige Tests in `include`. Workflow: `schedule` (wöchentlich) und `workflow_dispatch`, `npm ci`, `npm run mutation`, Bericht als Artefakt; Schwelle `break` bleibt 80.

- [ ] **Step 1:** Prüfen, dass die Zielmodule rein und mit Tests abgedeckt sind (Imports ohne I/O).
- [ ] **Step 2:** Konfiguration erweitern; `npm run mutation` lokal laufen lassen. Fällt die Schwelle, Ergebnis berichten statt senken.
- [ ] **Step 3:** Workflow anlegen; Commit `ci(mutation): Mutationstests wöchentlich`.

### Task 5: GitHub Actions per SHA pinnen

**Files:** Modify: `.github/workflows/*.yml`

**Interfaces:** Jede `uses:`-Zeile `owner/repo@<40-stelliger SHA> # vX.Y.Z`. SHAs per `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (bei Annotated Tags auf das Commit-Objekt auflösen). Dependabot (`github-actions`) hält die Pins aktuell, keine Änderung nötig.

- [ ] **Step 1:** Alle verwendeten Actions und Tags auflisten, SHAs ermitteln und gegenprüfen (`gh api …/commits/<sha>`).
- [ ] **Step 2:** Ersetzen; YAML mit `npx --yes yaml-lint` oder `actionlint` (falls vorhanden) prüfen.
- [ ] **Step 3:** Commit `ci: Actions per SHA gepinnt`.

## Abschluss

- [ ] `npm run check` und `npm test` grün; Gesamtprüfung durch `pruefer` über alle Commits.
- [ ] DoD-Receipt in der Abschlussmeldung; ROADMAP/CHANGELOG nach AGENTS.md Invariante 11.
