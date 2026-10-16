# Löschpipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dossiers werden vollständig, auditiert und nachweisbar gelöscht; Aufbewahrungsfristen sind Daten; Personenbezug in der Hash-Kette ist durch Pseudonyme ersetzt.

**Architecture:** Datenbankfunktionen löschen transaktional und schreiben `DOSSIER_DELETED`. Storage-Objekte laufen über die Outbox `deletion_tasks`, die ein Cron-Endpunkt abarbeitet. Der Audit-Trigger schreibt pro (Dossier, Nutzer) ein Pseudonym; die Zuordnung liegt außerhalb der Kette und wird mit dem Dossier gelöscht.

**Tech Stack:** Next.js Route Handler, Supabase (PostgreSQL, RLS, Storage), Zod, Vitest (`npm test`, `npm run test:db`).

**Spec:** [2026-10-16-loeschpipeline-design.md](../specs/2026-10-16-loeschpipeline-design.md)

## Global Constraints

- Migrationen nur in die bestehenden Domänendateien `20260915000000_core_multi_tenancy.sql`, `20260916000000_knowledge_and_vector.sql`, `20260921000000_jobs_and_workflows.sql` (AGENTS.md Invariante 8). Keine Seed-Fristen (rechtlich ungeklärt, fail-closed).
- `src/types/`: nur Zod, Typen, `as const`; keine Logik. Kein `any`, kein `as unknown as`.
- Repositories werfen bei Fehlern (fail-fast); `console.warn`-Schlucken wie in `SupabaseDossierRepository.delete` entfällt.
- Routen: Zod, Server-Auth über `requirePermission(..., PERMISSION_ACTIONS.DELETE_DOSSIER, ...)`, Delegation.
- Nutzertexte deutsch, Begriffe aus `src/lib/dossier/constants.ts`; keine Paragraphen als Schmuck; UI mit 4 Zuständen und Primitiven aus `src/components/ui/`.
- Löschgründe sind eine feste Enumeration (kein Freitext in der Kette): `ENTWURF_VERWORFEN`, `FEHLERHAFT_ANGELEGT`, `AUFBEWAHRUNG_ABGELAUFEN`, `SONSTIGES`.
- Gates: `npm run check`, `npm test`, `npm run test:db`. Hooks nie mit `--no-verify` umgehen. Commit je grüner Einheit, Co-Authored-By-Zeile laut Session.

## Review Focus

1. Doppeltes Löschen derselben ID (Doppelklick, Retry): zweiter Aufruf ändert nichts, erzeugt kein zweites `DOSSIER_DELETED`, liefert 404.
2. Manipulierter `payload.files[].storagePath` in `dossier_jobs` (zeigt auf Pfad einer fremden Kanzlei): wird nicht in die Outbox übernommen.
3. Storage-Objekt existiert nicht mehr: Aufgabe wird `DONE`, nicht endlos wiederholt.
4. Laufender Job (`locked_at` gesetzt) zum Dossier: Löschen wird abgelehnt statt Datenreste zu hinterlassen.
5. Dieselbe Person bearbeitet zwei Dossiers: Löschen des einen entfernt das Pseudonym des anderen nicht.

---

### Task 1: Verträge

**Files:**

- Create: `src/types/deletion.ts`, `src/types/deletion.test.ts`
- Modify: `src/types/audit.ts` (`AUDIT_ACTIONS`, `AuditActionSchema`), `src/types/database.ts` (`DB_TABLES`, Zeilentypen für `deletion_tasks`, `audit_actor_map`, neue Spalten), `src/lib/dossier/constants.ts` (deutsche Labels der Gründe, „Gelöschter Nutzer“, Dialogtexte)

**Interfaces:**

- Produces in `src/types/deletion.ts`: `DELETION_REASONS` (`as const`, Werte siehe Global Constraints), `DeletionReasonSchema`, `DELETION_TASK_STATUS = { PENDING, DONE, FAILED }`, `DeletionReceiptSchema = { documentId: string, deletedRows: Record<string, number>, storageTasks: number }` und `DeleteDossierRequestSchema = { reason: DeletionReason }`; abgeleitete Typen via `z.infer`.
- Produces in `audit.ts`: `AUDIT_ACTIONS.DOSSIER_DELETED`, `AUDIT_ACTIONS.DOSSIER_PURGE_COMPLETED`; `AuditLogDetailsSchema` erhält optional `deletion: { reason, deletedRows, storageTasks }`.

- [ ] **Step 1:** Test `deletion.test.ts`: `DeleteDossierRequestSchema` lehnt fehlenden und unbekannten Grund ab; `DeletionReceiptSchema` lehnt negative Zählwerte ab; `AuditActionSchema` akzeptiert beide neuen Ereignisse.
- [ ] **Step 2:** `npx vitest run src/types/deletion.test.ts` → FAIL.
- [ ] **Step 3:** Schemas, Konstanten und Labels anlegen.
- [ ] **Step 4:** Test → PASS; `npm run type-check`.
- [ ] **Step 5:** Commit `feat(types): Verträge für Löschpipeline`.

### Task 2: Pseudonymisierung der Audit-Kette

**Files:**

- Modify: `supabase/migrations/20260915000000_core_multi_tenancy.sql` (Tabelle `audit_actor_map`, Trigger `audit_logs_chain`), `src/lib/audit/audit-repository.ts` (`getHistory`, `toEntry`), `src/lib/audit/audit-repository.test.ts`
- Test: `src/test/db/audit-pseudonym.db.test.ts`

**Interfaces:**

- Tabelle `audit_actor_map(document_id TEXT, user_id UUID, organization_id UUID NOT NULL, actor_ref UUID NOT NULL DEFAULT gen_random_uuid(), display_name TEXT NOT NULL, PRIMARY KEY (document_id, user_id))`; RLS: SELECT für `is_org_member(organization_id)`, Schreiben nur über den SECURITY-DEFINER-Trigger.
- Trigger-Verhalten: Mit `auth.uid()` wird die Zeile (Dossier, Nutzer) angelegt bzw. gelesen (`display_name` = vom Client gelieferter `actor`), dann gilt `NEW.actor := actor_ref::text` und `NEW.actor_id := NULL`; der Hash läuft über diese Werte. Ohne `auth.uid()` bleibt `actor` wie geliefert (Systemakteur, z. B. `SYSTEM`).
- `getHistory` ersetzt `actor` pro Eintrag durch `display_name` aus `audit_actor_map`; fehlt die Zeile und der Wert ist eine UUID, gilt das Label „Gelöschter Nutzer“ aus `constants.ts`.

- [ ] **Step 1:** DB-Test: Eintrag von Nutzer A in Dossier X → `audit_logs.actor` ist UUID, `actor_id` ist NULL; `verify_audit_chain(X)` gültig; `getHistory` liefert Klarnamen. Zweiter Eintrag desselben Nutzers nutzt dasselbe Pseudonym. Nach `DELETE FROM audit_actor_map WHERE document_id = X` bleibt die Kette gültig und `getHistory` liefert „Gelöschter Nutzer“. Nutzer aus Kanzlei B sieht die Zuordnung nicht (Mandantentrennung). Unit-Test im Repository für das Label.
- [ ] **Step 2:** `npx vitest run src/lib/audit/audit-repository.test.ts` und `npm run test:db -- audit-pseudonym` → FAIL.
- [ ] **Step 3:** Migration und Repository ändern. Lokal `npm run db:reset`. Bestehende Tests `audit-chain.db.test.ts` und `rbac.db.test.ts` anpassen, falls sie `actor`/`actor_id` im Klartext erwarten.
- [ ] **Step 4:** Alle drei Testläufe grün.
- [ ] **Step 5:** Commit `feat(audit): Pseudonyme statt Personenbezug in der Hash-Kette`.

### Task 3: Löschfunktionen und Outbox (Datenbank)

**Files:**

- Modify: `supabase/migrations/20260915000000_core_multi_tenancy.sql` (`documents.retention_anchor_at TIMESTAMPTZ NULL`), `supabase/migrations/20260916000000_knowledge_and_vector.sql` (`knowledge_documents.retention_years INT NULL CHECK (retention_years > 0)`), `supabase/migrations/20260921000000_jobs_and_workflows.sql` (Tabelle, Funktionen)
- Test: `src/test/db/dossier-deletion.db.test.ts`

**Interfaces (SQL):**

- Tabelle `deletion_tasks(id UUID PK, organization_id UUID NOT NULL, document_id TEXT NOT NULL, storage_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', attempts INT NOT NULL DEFAULT 0, last_error TEXT, created_at, updated_at)`; RLS: SELECT für Kanzleimitglieder, Schreiben nur `service_role`; Index `(status, created_at)`.
- `delete_dossier(p_document_id TEXT, p_reason TEXT) RETURNS JSONB` (SECURITY DEFINER, `search_path` fixiert): ermittelt die Kanzlei aus `documents`, prüft `get_user_role(org) IN ('NOTAR','NOTARASSESSOR','ADMIN')` (dieselbe Liste wie `rls_documents_delete`), lehnt unbekannte Gründe, nicht gefundenes Dossier und Dossiers mit laufendem Job (`locked_at IS NOT NULL`) ab. Löscht `workflow_instances` (`case_id`), `dossier_jobs` (`result_dossier_id`), `audit_actor_map` (`document_id`), dann `documents`. Legt `deletion_tasks` an für (a) `payload->'files'->*->>'storagePath'`, nur wenn der Pfad mit `org || '/'` beginnt, (b) alle `storage.objects` unter `org/archive/<id>/`. Hängt `DOSSIER_DELETED` mit `details.deletion` an die Kette an. Rückgabe entspricht `DeletionReceiptSchema`.
- `delete_dossier_system(p_document_id TEXT) RETURNS JSONB`: gleiche interne Routine, Akteur `SYSTEM`, Grund `AUFBEWAHRUNG_ABGELAUFEN`; `REVOKE ALL` von `public`/`authenticated`, nur `service_role`.
- `complete_dossier_purge(p_document_id TEXT) RETURNS BOOLEAN` (nur `service_role`): hängt `DOSSIER_PURGE_COMPLETED` an, wenn für das Dossier keine Aufgabe mehr `PENDING`/`FAILED` ist und das Ereignis noch fehlt.
- Interne Routine `_purge_dossier(...)` wird von beiden öffentlichen Funktionen genutzt; kein Zugriff von außen.

- [ ] **Step 1:** DB-Tests (Stil `rbac.db.test.ts`): (a) `it.each(NOTARY_ROLES)` Löschen folgt `hasPermission(role, DELETE_DOSSIER)`, abgelehnte Rolle lässt alle Zeilen intakt; (b) NOTAR: Dossier, Jobs, Instanzen, Map-Zeilen weg, `deletion_tasks` je Datei plus Archivobjekt, Kette gültig, `DOSSIER_DELETED` enthält Zähler und Grund; (c) fremder Pfad im Payload erzeugt keine Aufgabe; (d) zweiter Aufruf wirft „nicht gefunden“, kein zweites Ereignis; (e) laufender Job blockiert; (f) Nutzer anderer Kanzlei: keine Wirkung; (g) `authenticated` kann `delete_dossier_system` und `complete_dossier_purge` nicht aufrufen; (h) `complete_dossier_purge` mit offener Aufgabe → `false`, ohne → `true`, zweiter Aufruf → `false`; (i) Pseudonym der Person in anderem Dossier bleibt (Review Focus 5).
- [ ] **Step 2:** `npm run db:reset && npm run test:db -- dossier-deletion` → FAIL.
- [ ] **Step 3:** Migrationen schreiben. Schutz → Test: Rollenprüfung → (a); Pfadpräfix → (c); Mandantenfilter → (f); Jobsperre → (e); REVOKE → (g).
- [ ] **Step 4:** Test:db komplett grün.
- [ ] **Step 5:** Commit `feat(db): Löschfunktionen, Outbox und Aufbewahrungsspalten`.

### Task 4: Repository und Route

**Files:**

- Modify: `src/lib/supabase/repository.ts` (`IDossierRepository.delete`, `SupabaseDossierRepository.delete`), `src/lib/supabase/server.ts` (`deleteDossierRecord`), `src/app/api/documents/route.ts` (DELETE), Tests `src/lib/supabase/repository.test.ts` und Route-Test neben der Route (Stil der Nachbartests)

**Interfaces:**

- Consumes: `DeletionReceipt`, `DeleteDossierRequestSchema`, `DeletionReason` (Task 1); RPC `delete_dossier` (Task 3).
- Produces: `delete(id: string, reason: DeletionReason, organizationId?: string): Promise<DeletionReceipt>` (wirft bei Fehler; „nicht gefunden“ wird als eigener Fehlertyp `DossierNotFoundError` geworfen); `deleteDossierRecord(id: string, reason: DeletionReason, organizationId?: string, client?): Promise<DeletionReceipt>`.
- Route: Body per `DeleteDossierRequestSchema` (ungültig → 400, fehlende ID → 400, `DossierNotFoundError` → 404), Erfolg → `{ receipt }`. Die gesamte bisherige Aufräumlogik im Repository (Jobs, Archiv-Listing, Storage-Remove, `console.warn`) entfällt.

- [ ] **Step 1:** Tests: Repository ruft `rpc('delete_dossier', { p_document_id, p_reason })` und gibt den validierten Nachweis zurück; RPC-Fehler wirft; Routen-Test: fehlender Grund → 400, SACHBEARBEITER → 403, unbekannte ID → 404, Erfolg → 200 mit Nachweis.
- [ ] **Step 2:** `npx vitest run src/lib/supabase/repository.test.ts` + Routen-Test → FAIL.
- [ ] **Step 3:** Umsetzen; Aufrufer von `deleteDossierRecord` per Grep nachziehen.
- [ ] **Step 4:** Tests + `npm run type-check` grün.
- [ ] **Step 5:** Commit `feat(api): Dossier-Löschung über Datenbankfunktion mit Nachweis`.

### Task 5: Worker, Fristlogik und Cron

**Files:**

- Create: `src/lib/dossier/retention.ts` (+ `.test.ts`), `src/lib/dossier/deletion-worker.ts` (+ `.test.ts`), `src/app/api/cron/deletion/route.ts` (+ Test), `vercel.json` (Cron-Eintrag)
- Modify: `src/env.ts` (`CRON_SECRET`), `.env.example`

**Interfaces:**

- `isRetentionExpired(anchorAt: Date, retentionYears: number, now: Date): boolean` (reine Funktion; Ablauf = Anker plus Jahre ≤ jetzt).
- `processDeletionTasks(admin: SupabaseClient<Database>, opts: { batchSize: number; maxAttempts: number }): Promise<{ done: number; failed: number; purged: number }>`: nimmt `PENDING`-Aufgaben, prüft Pfadpräfix `organization_id/` erneut, entfernt das Objekt (fehlendes Objekt = Erfolg), setzt `DONE`; Fehler erhöhen `attempts`, ab `maxAttempts` → `FAILED` mit `last_error`; danach `complete_dossier_purge` je betroffenem Dossier.
- `runRetentionSweep(admin, deps: { knowledge: IKnowledgeRepository; now: Date }): Promise<{ deleted: number }>`: liest Fristen aus `knowledge_documents.retention_years` (geprüfte Einträge), iteriert Dossiers mit gesetztem `retention_anchor_at`, ruft `delete_dossier_system`. Ohne Fristdatensatz: nichts löschen. Filterung läuft in PostgreSQL (kein Laden aller Dossiers).
- Route `POST /api/cron/deletion`: verlangt `Authorization: Bearer ${CRON_SECRET}` (sonst 401, Vergleich zeitkonstant), nutzt Service-Role-Client, ruft beide Funktionen.

- [ ] **Step 1:** Tests: Fristgrenze (genau am Stichtag, Schaltjahr); Worker: Pfad außerhalb der Kanzlei wird nicht gelöscht und `FAILED`; fehlendes Objekt → `DONE`; Fehler → `attempts` steigt, nach `maxAttempts` `FAILED`; Reinigung ruft `complete_dossier_purge` nur nach letzter Aufgabe; Sweep ohne Fristdatensatz löscht nichts, mit abgelaufener Frist genau die fälligen; Route: ohne/mit falschem Secret → 401.
- [ ] **Step 2:** `npx vitest run src/lib/dossier/retention.test.ts src/lib/dossier/deletion-worker.test.ts src/app/api/cron` → FAIL.
- [ ] **Step 3:** Umsetzen. Schutz → Test: Secret-Prüfung → Routentest; Pfadpräfix → Workertest; fail-closed → Sweep-Test.
- [ ] **Step 4:** Tests grün; `npm run depcruise`.
- [ ] **Step 5:** Commit `feat(lib): Löschworker, Fristlogik und Cron-Endpunkt`.

### Task 6: Löschdialog

**Files:**

- Modify: die Komponente, die heute `DELETE /api/documents` auslöst (per Grep nach `method: 'DELETE'` bzw. dem Hook ermitteln), `src/components/ui/ConfirmDialog.tsx` nur wenn ein Auswahlfeld nicht per Slot möglich ist
- Test: Komponententest neben der Komponente (Stil der Nachbartests, `vitest-axe` für A11y)

**Interfaces:**

- Consumes: `DELETION_REASONS`, Labels aus `constants.ts`, `DELETE /api/documents` mit Body `{ reason }`.
- Verhalten: Grundauswahl ist Pflicht, Bestätigen bleibt deaktiviert bis gewählt; Pending-Zustand sperrt Steuerelemente; Fehlerzustand mit „Erneut versuchen“; nach Erfolg Meldung „Löschung läuft“ solange `deletion_tasks` offen sind, danach „Gelöscht“; Query-Invalidierung über `@tanstack/react-query`.

- [ ] **Step 1:** Tests: Bestätigen ohne Grund deaktiviert; Absenden sendet gewählten Grund; Pending sperrt; Fehler zeigt Retry; keine a11y-Verstöße.
- [ ] **Step 2:** Testlauf → FAIL.
- [ ] **Step 3:** Umsetzen mit vorhandenen Primitiven; Texte nur aus `constants.ts`.
- [ ] **Step 4:** Tests grün; Sichtprüfung per Playwright (kein Layoutsprung, mobil und Desktop).
- [ ] **Step 5:** Commit `feat(ui): Löschdialog mit Pflichtgrund`.

### Task 7: Dokumentation, Gesamtprüfung, Datenbank-Sync

**Files:**

- Modify: `docs/architecture/multi-tenancy-compliance.md`, `docs/overview.md`, `ROADMAP.md`, `CHANGELOG.md`, Spec (Status auf „umgesetzt, offene Punkte“)

- [ ] **Step 1:** Doku nachziehen: Löschfluss, Outbox, Pseudonyme, Fristquelle; keine Checklisten in Architekturdokumenten (Invariante 11).
- [ ] **Step 2:** `npm run check`, `npm test`, `npm run test:db` → alle grün.
- [ ] **Step 3:** Supabase-Sync: Migrationen per MCP gegen das Projekt anwenden und prüfen, **nur nach ausdrücklicher Zustimmung des Nutzers**; sonst als offener Punkt `- [ ] Pending Live DB Migration:` im DoD-Beleg.
- [ ] **Step 4:** Gesamtprüfung des Zweigs durch das stärkste Modell (Sicherheitsrelevanz: Auth, Datenverlust, neue Angriffsfläche), Befunde beheben.
- [ ] **Step 5:** Commit `docs(löschung): Architektur, Roadmap und Changelog`; DoD-Beleg ausgeben.

## Nicht in diesem Plan

Setzen von `retention_anchor_at` (Auslöser „Beurkundung abgeschlossen“ fehlt im Produkt), Fristdatensätze selbst (rechtlich offen), Freitext in `details` (`note`, `override.reason`, `caseTitle` können Personenbezug enthalten und bleiben in der Kette), Jobs ohne `result_dossier_id`, Backups.
