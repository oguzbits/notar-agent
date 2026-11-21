# Härtung aus dem Projektvergleich, Teil 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Die acht verbliebenen Befunde des Projektvergleichs und zwei Vorarbeiten für die Job-Queue umsetzen.

**Architecture:** Bündel 1 (Code ohne Migration), Bündel 2 (Migrationen in den bestehenden Domänendateien, `DECLARATION_STAGED`), Bündel 3 (Doku). Seriell, je Bündel ein Commit-Satz.

**Tech Stack:** Next.js 16, Vitest, Zod, PostgreSQL/Supabase, Stryker.

**Spec:** Vergleichsbericht dieser Sitzung; [Teil 1](2026-11-21-vergleichsbefunde-haertung.md); ROADMAP B.11.7 und C.7; AGENTS.md Invarianten 4, 8, 9, 10.

## Global Constraints

- Migrationen nur in `supabase/migrations/20260915000000_core_multi_tenancy.sql`, `20260916000000_knowledge_and_vector.sql`, `20260921000000_jobs_and_workflows.sql`; keine neue Datei. Nicht live einspielen (Free-Plan, kein lokales Supabase verfügbar): Impact `DECLARATION_STAGED`, offener Punkt "Pending Live DB Migration" mit Datei und Projekt-Ref im Abschluss.
- Logformat bleibt `LogEventSchema` (`.strict()`, kein Freitext); Zähler nur nach Ursachenart.
- Keine absoluten Pfade in Dateien; Specs ohne Aufgabenlisten; Doku-Drift mit `covers:` pflegen.
- Jeder Test einer Schutzfunktion muss ohne die Schutzfunktion rot werden (Gegenprobe).

## Review Focus

- `recoverOrphanJobs`: Vorgang mit frischem `locked_at`, aber altem `updated_at` darf nicht auf FAILED fallen.
- Rollenwechsel NOTAR→niedriger durch ADMIN wird vom Trigger abgelehnt; NOTAR darf es weiter.
- Upload-URL: Überschreitung der Grenze ergibt 429 mit `Retry-After`, andere Kanzlei bleibt unberührt.
- Abweichendes Embedding-Modell: Treffer aus Vektoren eines anderen Modells werden nicht verwendet.
- Zähler für Verwerfungsgründe enthalten nie Dateinamen oder Textausschnitte.

---

## Bündel 1: Code ohne Migration

### Task 1: Request-Kennung in Worker und Cron; Heilung beachtet `locked_at`

**Files:** `src/lib/jobs/job-worker.ts`, `src/lib/jobs/job-repository.ts` (`recoverOrphanJobs`), `src/app/api/cron/deletion/route.ts`, `src/app/api/analyze/route.ts`, zugehörige Tests.

**Interfaces:**

- `executeDossierJob` erhält die Kennung als zusätzlichen optionalen Parameter `requestId?: string`; alle `logFailure`-Aufrufe im Worker reichen sie durch.
- Cron liest `REQUEST_ID_HEADER` aus dem Request und gibt sie an `logFailure` weiter.
- `recoverOrphanJobs(leaseTimeoutMs?, organizationId?)` setzt nur Vorgänge, bei denen `updated_at` UND (`locked_at` IS NULL ODER `locked_at`) älter als die Frist sind.

Tests: Worker-Logzeile trägt `requestId`; ohne Kennung kein Feld; `recoverOrphanJobs` filtert über `locked_at` (Mock-Assertion auf den Filter); Gegenprobe: ohne `locked_at`-Bedingung rot. DB-Test in `src/test/db/job-claim.db.test.ts` ergänzen (läuft nur lokal mit Supabase, wird nicht ausgeführt).

### Task 2: Mutationstest-Qualität von `readiness.ts`

**Files:** `src/lib/dossier/readiness.test.ts`, `stryker.config.json`, `config/vitest.mutation.config.mts`.

Tests so ergänzen, dass die 26 unabgedeckten Mutanten und die überlebenden getötet werden; danach `readiness.ts` wieder in `mutate` und den Test in `include` aufnehmen. Ziel: Gesamtscore ≥ 80 (`break`), `readiness.ts` für sich ≥ 70. Schwelle nicht senken.

### Task 3: Verwerfungsgründe zählen (nur Log, Ursachenart)

**Files:** `src/lib/ai/verifiable-fact-checker.ts`, `src/types/observability.ts`, `src/lib/observability/logger.ts` bzw. Aufrufer im Worker, Tests.

**Interfaces:**

- Reine Funktion `countVerificationReasons(issues: VerificationIssue[]): Record<VerificationReason, number>` mit `VerificationReason` als `as const`-Aufzählung in `src/types/` (Ursachenarten der bestehenden `reason`-Werte).
- `LogEventSchema` bekommt optional `verificationReasonCounts` (Zahlen je Art, strict).
- Worker loggt nach der Verifikation ein Ereignis `verifikation_zusammenfassung` nur, wenn mindestens ein Eintrag verworfen wurde.

Tests: Zählung je Art; Schema lehnt Freitext-Schlüssel ab; Worker loggt ohne Dateinamen/Snippets.

---

## Bündel 2: Migrationen (`DECLARATION_STAGED`)

### Task 4: Upload-URL-Rate-Grenze

**Files:** `src/app/api/storage/upload-url/route.ts`, `src/lib/storage/` (Quota-Prüfung), `src/types/storage.ts` (Konstante `UPLOAD_URL_RATE_LIMIT`), `20260921000000_jobs_and_workflows.sql` (oder Core, wo die Bucket-Logik liegt), Test.

**Interfaces:** SQL-Funktion `count_recent_uploads(p_organization_id UUID, p_window INTERVAL) RETURNS INT` (SECURITY INVOKER, `search_path` gesetzt, zählt `storage.objects` des Buckets `dossier-files` mit Kanzleipräfix). Route antwortet bei Überschreitung 429 mit `Retry-After`. Prüfung nach `requirePermission`, vor `createSignedUploadUrl`.

### Task 5: ADMIN darf keinen NOTAR herabstufen oder entfernen

**Files:** Trigger `organization_members_guard` in `20260915000000_core_multi_tenancy.sql`, `src/test/db/team-guard.db.test.ts`, `src/lib/team/team-repository.ts` (Fehlerabbildung, falls nötig), Unit-Test.

Regel: Eine Änderung oder Löschung einer Mitgliedschaft mit Rolle `NOTAR` ist nur durch einen `NOTAR` zulässig (der letzte NOTAR bleibt weiter geschützt). Die bestehende SQLSTATE-Abbildung wird wiederverwendet.

### Task 6: Embedding-Modell-Abgleich

**Files:** `20260916000000_knowledge_and_vector.sql` (Spalte `embedding_model TEXT`), `scripts/knowledge/embed-documents.ts` (schreibt die Modellkennung), `match_knowledge_documents` (Parameter `p_embedding_model TEXT`, nur passende Zeilen), Aufrufer in `src/lib/knowledge/`, Tests, `src/env.ts` unverändert (`EMBEDDING_MODEL_ID` bleibt die Quelle).

Regel: Vektoren ohne oder mit anderer Modellkennung werden bei der Suche ignoriert; das Einbettungsskript meldet Zeilen mit abweichendem Modell als veraltet.

---

## Bündel 3: Doku (kein Code)

### Task 7: Datenmodell, SLO, Skalierung, Lesbarkeit

- `docs/architecture/datenmodell.md` (Tabellen, Beziehungen, RLS-Kurzform), `docs/betrieb/slo.md` (Ziele und Messpunkte aus vorhandenen Daten), `docs/betrieb/skalierung.md` (Grenzen heute, Auslöser für die echte Job-Queue, Ergebnis der Prüfung von `pg_cron`/`pg_net` für den Free-Plan, Quelle Supabase-Doku).
- `docs/ARCHITECTURE.md`: überlange Absätze (z. B. §1.6) in Listen/Tabellen gliedern; `covers:` auf `src/lib/`, `src/app/api/`, `src/types/`, `supabase/migrations/` erweitern, soweit der Drift-Check es verlangt.
- ROADMAP/CHANGELOG nachführen, B.11.7 Punkte 2 und 5 abhaken und nach CHANGELOG verschieben.
