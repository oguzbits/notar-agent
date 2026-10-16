# Serverseitiges RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede schreibende oder freigabekritische Route prüft die Aktion serverseitig gegen die Rolle aus der Mitgliedschaft; die RLS erzwingt das Löschrecht in der Datenbank; Verweigerungen landen in der Audit-Kette.

**Architecture:** Ein Guard `requirePermission` in `src/lib/auth/` baut auf `resolveSessionOrganizationId`/`resolveSessionActor` auf und nutzt die bestehende Matrix `hasPermission`. Routen rufen ihn als ersten Schritt auf und mappen `AuthzError` auf 401/403. Die RLS-Policy für `documents` wird kanonisch in der Core-Migration nach Operation getrennt.

**Tech Stack:** Next.js Route Handlers, Zod, Supabase (`@supabase/ssr`), Vitest (`npm test`, `npm run test:db`).

**Spec:** [2026-10-16-serverseitiges-rbac-design.md](../specs/2026-10-16-serverseitiges-rbac-design.md)

## Global Constraints

- Matrix `ROLE_PERMISSIONS` in [src/lib/auth/rbac.ts](../../../src/lib/auth/rbac.ts) bleibt einzige Quelle; keine zweite Rollenlogik im Server.
- Rolle je Request aus `organization_members`, kein JWT-Claim.
- `x-organization-id`/`organizationId` nur Auswahl unter eigenen Mitgliedschaften.
- `src/types/` ohne Funktionen und ohne Importe aus `src/lib/` (Klasse `AuthzError` gehört daher nach `src/lib/auth/`).
- Fehlermeldungen und UI-Texte auf Deutsch; Fail-Fast: DB-Fehler werden geworfen, nie als 403 verschluckt.
- Keine Mikro-Migration: SQL-Änderung in `supabase/migrations/20260915000000_core_multi_tenancy.sql`.
- Commit je grüner Einheit, nie `--no-verify`. Quality Gates: `npm run check` und `npm test`.

## Review Focus

- Nutzer mit Mitgliedschaft in zwei Kanzleien, Header zeigt auf die Kanzlei mit der schwächeren Rolle: es gilt die Rolle dieser Kanzlei, nicht die der ersten.
- Header/Query zeigt auf eine fremde Kanzlei: 401, kein Audit-Eintrag in der fremden Kanzlei.
- Mehrere Verweigerungen derselben Kanzlei hintereinander: Hash-Kette bleibt gültig (`verify_audit_chain`).
- Abgemeldeter Nutzer (kein Cookie): 401 ohne Audit-Schreibversuch.
- Rollenwechsel während einer laufenden Sitzung: der nächste Request nutzt die neue Rolle.

## Zuordnung Route → Aktion (gegen die Handler abgeglichen)

| Route                                                                                               | Aktion                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `DELETE /api/documents`, `DELETE /api/jobs/[id]`                                                    | `DELETE_DOSSIER`                                                    |
| `PUT /api/analyze` mit `auditOverride`                                                              | `OVERRIDE_FIELD_STATUS`                                             |
| `PUT /api/analyze` ohne `auditOverride`                                                             | `UPLOAD_DOCUMENTS`                                                  |
| `POST /api/analyze`, `POST /api/jobs`, `POST /api/jobs/[id]/cancel`, `POST /api/storage/upload-url` | `UPLOAD_DOCUMENTS`                                                  |
| `POST /api/team`, `PATCH`/`DELETE /api/team/[id]`, `PUT /api/organization`                          | `MANAGE_TEAM`                                                       |
| Lesende Routen (`GET`), `auth/*`, `POST /api/organization`                                          | unverändert (nur Mitgliedschaft bzw. Bootstrap ohne Mitgliedschaft) |

`FINAL_APPROVAL` und `EXPORT_OFFICIAL_REPORT` haben aktuell keine Server-Route; sie bleiben in der Matrix und werden beim Anlegen der Route mit dem Guard verdrahtet (siehe Out-of-Scope).

## Task 1: Vertrag und Guard

**Files:**

- Modify: `src/types/audit.ts` (`AUDIT_ACTIONS`, `AuditActionSchema`: `ACCESS_DENIED`; `AuditLogDetailsSchema`: optionale Felder `deniedAction` (`PermissionActionSchema`) und `route` (string))
- Modify: `src/types/auth.ts` (`SessionContextSchema`, Typ `SessionContext`)
- Create: `src/lib/auth/require-permission.ts`
- Test: `src/lib/auth/require-permission.test.ts`

**Interfaces:**

- Produces:
  - `SessionContext = { userId: string; organizationId: string; role: NotaryRole; actorLabel: string }`
  - `class AuthzError extends Error { constructor(readonly status: 401 | 403, message: string) }`
  - `requirePermission(supabase: SupabaseClient<Database> | null, action: PermissionAction, options?: { requestedOrgId?: string; route?: string }): Promise<SessionContext>`

Verhalten: kein Client/Nutzer/passende Mitgliedschaft → `AuthzError(401, 'Nicht authentifiziert oder keine Kanzlei zugeordnet.')`. `hasPermission` false → ein `ACCESS_DENIED` über `SupabaseAuditRepository.appendEvent` mit `documentId: 'access-denied:<organizationId>'`, `actor: actorLabel`, `details: { deniedAction, route, actorRole }`, danach `AuthzError(403, 'Keine Berechtigung für diese Aktion.')`. Fehler beim Audit-Schreiben oder bei der Rollenabfrage werden weitergeworfen (500 in der Route), nie in 403/401 umgewandelt. Der `userId` kommt aus `auth.getUser()`.

- [ ] **Step 1: Failing tests** in `require-permission.test.ts` (Supabase-Client als Stub im Stil von [server-auth.test.ts](../../../src/lib/supabase/server-auth.test.ts)):
  - `wirft 401 ohne Client` und `wirft 401 ohne Nutzer`
  - `wirft 401 bei fremder angefragter Kanzlei und schreibt kein Audit`
  - `liefert SessionContext für berechtigte Rolle` (NOTAR + `DELETE_DOSSIER`)
  - `wirft 403 für SACHBEARBEITER + DELETE_DOSSIER und schreibt genau einen ACCESS_DENIED mit deniedAction, route, actorRole`
  - `nutzt die Rolle der angefragten Kanzlei bei Mehrfachmitgliedschaft` (NOTAR in Kanzlei A, SACHBEARBEITER in B, angefragt B → 403)
  - `reicht DB-Fehler der Rollenabfrage als Error durch (kein AuthzError)`
  - `reicht Audit-Schreibfehler als Error durch (kein 403)`
- [ ] **Step 2:** `npx vitest run src/lib/auth/require-permission.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** Schemas in `src/types/` ergänzen, dann Guard und `AuthzError` in `require-permission.ts` implementieren; `resolveSessionActor` liefert `role` als string, Guard parst sie mit `NotaryRoleSchema.parse`.
- [ ] **Step 4:** Test erneut → PASS; zusätzlich `npm run type-check`. Schutzprüfung: `hasPermission`-Aufruf vorübergehend auf `true` stellen, Test „wirft 403“ muss rot werden; zurücknehmen.
- [ ] **Step 5:** Commit `feat(auth): serverseitiger Berechtigungs-Guard mit Audit der Verweigerung`.

## Task 2: Zerstörende und Team-Routen verdrahten

**Files:**

- Modify: `src/app/api/documents/route.ts` (DELETE), `src/app/api/jobs/[id]/route.ts` (DELETE), `src/app/api/team/route.ts` (POST), `src/app/api/team/[id]/route.ts` (PATCH, DELETE), `src/app/api/organization/route.ts` (PUT)
- Test: bestehende Route-Tests je Datei ergänzen, sonst neue `route.test.ts` daneben

**Interfaces:**

- Consumes: `requirePermission`, `AuthzError`, `SessionContext` aus Task 1.

Je Handler: `const ctx = await requirePermission(authSupabase, <Aktion>, { requestedOrgId, route: '<METHOD /api/...>' })` als erster Schritt nach dem Parsen; `ctx.organizationId` ersetzt `resolveSessionOrganizationId`. Im `catch`: `if (error instanceof AuthzError) return NextResponse.json({ error: error.message }, { status: error.status })` vor dem 500-Pfad. `GET`-Handler derselben Dateien bleiben unverändert. `organization` PUT: Rolle der Kanzlei des Nutzers, die bestehende Mitgliedschaftsabfrage in der Route entfällt, wo der Guard sie ersetzt.

- [ ] **Step 1: Failing tests**, je Route `it.each` über Rollen: `SACHBEARBEITER` bzw. `ANWALTSNOTAR_RA` → 403 und Repository-Aufruf (`deleteDossierRecord`, Team-Repo, …) wird **nicht** aufgerufen; berechtigte Rolle → 200/204. `DELETE /api/documents` mit `ADMIN`/`NOTAR`/`NOTARASSESSOR` erlaubt. Zusätzlich: gefälschter `x-organization-id` einer fremden Kanzlei → 401.
- [ ] **Step 2:** `npx vitest run src/app/api` → FAIL.
- [ ] **Step 3:** Guard einbauen wie oben beschrieben.
- [ ] **Step 4:** Tests PASS. Schutzprüfung: Guard in `documents` DELETE auskommentieren → der 403-Test muss rot werden.
- [ ] **Step 5:** Commit `feat(api): Rollenprüfung für Löschen, Team und Kanzlei-Update`.

## Task 3: Schreibende Upload- und Analyse-Routen

**Files:**

- Modify: `src/app/api/analyze/route.ts` (POST, PUT), `src/app/api/jobs/route.ts` (POST), `src/app/api/jobs/[id]/cancel/route.ts` (POST), `src/app/api/storage/upload-url/route.ts` (POST)
- Test: `route.test.ts` je Datei (ergänzen oder anlegen)

**Interfaces:**

- Consumes: wie Task 2. `PUT /api/analyze`: Aktion `OVERRIDE_FIELD_STATUS`, wenn `auditOverride` im geparsten Body gesetzt ist, sonst `UPLOAD_DOCUMENTS`. `sessionActor.label` und `.role` im bestehenden Audit-Pfad werden durch `ctx.actorLabel` und `ctx.role` ersetzt.

- [ ] **Step 1: Failing tests:** `ADMIN` hat kein `OVERRIDE_FIELD_STATUS` → `PUT /api/analyze` mit `auditOverride` ergibt 403 und `repo.update` wird nicht aufgerufen; `SACHBEARBEITER` darf mit `auditOverride` (hat `OVERRIDE_FIELD_STATUS`); Body-Feld `actor`/`actorRole` (falls vom Schema durchgelassen) erscheint nicht im Audit-Eintrag, dieser trägt `ctx.actorLabel`. Je POST-Route: ohne Sitzung 401, mit fremdem `x-organization-id` 401.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Guard einbauen; Aktionswahl in `analyze` PUT als einzeiliger Ausdruck.
- [ ] **Step 4:** PASS; Schutzprüfung: Guard in `analyze` PUT entfernen → Override-Test rot.
- [ ] **Step 5:** Commit `feat(api): Rollenprüfung für Upload, Analyse und Override`.

## Task 4: RLS nach Operation und Paritätstest

**Files:**

- Modify: `supabase/migrations/20260915000000_core_multi_tenancy.sql` (Policy `rls_documents_all` ersetzen durch `rls_documents_select`, `_insert`, `_update` mit `is_org_member(organization_id)` und `rls_documents_delete` mit `get_user_role(organization_id) IN ('NOTAR', 'NOTARASSESSOR', 'ADMIN')`; alte Policy per `DROP POLICY IF EXISTS` entfernen)
- Test: `src/lib/auth/rbac-sql-parity.test.ts` (neu), `src/test/db/rbac.db.test.ts` (neu)

Hinweis zur Spec: `rls_audit_logs_insert` erlaubt Einfügen bereits für jedes Mitglied; `ACCESS_DENIED` braucht daher keine Policy-Änderung.

- [ ] **Step 1: Failing tests:**
  - Parität: liest die Migration, extrahiert die Rollenliste aus `rls_documents_delete` und erwartet Gleichheit mit der Menge der Rollen, für die `hasPermission(role, DELETE_DOSSIER)` gilt (`NOTARY_ROLES` durchlaufen).
  - DB-Test (Stil [tenant-isolation.db.test.ts](../../../src/test/db/tenant-isolation.db.test.ts)): `SACHBEARBEITER` löscht Dossier → 0 Zeilen betroffen, Zeile existiert noch; `NOTAR` löscht → Zeile weg; Mitglied schreibt `ACCESS_DENIED`-Eintrag → Kette gültig (`verify_audit_chain`), zweiter Eintrag direkt danach ebenfalls gültig.
- [ ] **Step 2:** `npx vitest run src/lib/auth/rbac-sql-parity.test.ts` → FAIL; DB-Test wird erst nach Migration grün.
- [ ] **Step 3:** Migration ändern. Lokal anwenden (`supabase db reset` im bestehenden Docker-Setup), dann `npm run test:db`.
- [ ] **Step 4:** Paritätstest PASS und DB-Tests PASS. Schutzprüfung: `'ADMIN'` aus der Delete-Policy entfernen → Paritätstest rot.
- [ ] **Step 5:** Commit `feat(rls): Löschrecht für Dossiers rollenabhängig in der Datenbank`.
- Live-Stand: Migration wird nicht remote angewendet; `DECLARATION_STAGED`, Eintrag im DoD unter Out-of-Scope (Datei und Projekt-Ref ergänzen). Anwendung per Supabase MCP nur nach Zustimmung.

## Task 5: Dokumentation und Gesamtprüfung

**Files:**

- Modify: `docs/overview.md` (Abschnitt Autorisierung: Guard, Matrix als SSOT, RLS-Spiegel, Audit der Verweigerung), `ROADMAP.md`, `CHANGELOG.md`

- [ ] **Step 1:** Doku ergänzen (keine Checklisten in `docs/`; Fortschritt nur in ROADMAP/CHANGELOG).
- [ ] **Step 2:** `npm run check` und `npm test` → 0 Fehler, Health-Score ≥ 90. `npm run test:db` grün.
- [ ] **Step 3:** Gesamtprüfung des Commit-Bereichs durch einen Reviewer mit dem stärksten Modell; Befunde beheben.
- [ ] **Step 4:** Commit `docs(rbac): Autorisierung in Architekturdoku und Changelog`.

## Out-of-Scope

- [ ] Pending Live DB Migration: `supabase/migrations/20260915000000_core_multi_tenancy.sql` (Projekt-Ref beim Anwenden eintragen).
- Server-Routen für `FINAL_APPROVAL` und `EXPORT_OFFICIAL_REPORT` existieren noch nicht und werden bei ihrer Einführung mit dem Guard gebaut.
- Rollen im JWT, Rechte-Editor in der UI, Löschpipeline, Observability, Kostenerfassung.

## Ausführungshinweise

- Modellstufen: Task 1 und 4 mit dem stärksten Modell (Sicherheitslogik, SQL), Task 2 und 3 mittleres Modell, Task 5 mittleres Modell. Review pro Task nur für 1 und 4, sonst Gesamtprüfung am Ende.
- Ledger: je Task Dauer und Subagent-Tokens mitschreiben, am Ende Summenzeile melden.
- Vor `supabase db reset`: `df -h` prüfen.
