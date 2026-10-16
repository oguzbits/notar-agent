# Serverseitiges RBAC – Design

Stand: 2026-10-16. Status: Entwurf, Freigabe des Chat-Designs liegt vor; Spec zur Prüfung.

## Ziel

Jede schreibende oder freigabekritische Aktion wird auf dem Server gegen die Rolle des Nutzers in der
aktiven Kanzlei geprüft. Die Datenbank erzwingt dieselbe Regel per RLS. Rolle und Kanzlei kommen
ausschließlich aus Sitzung und Mitgliedschaft.

## Ausgangslage

- `hasPermission(role, action)` ([src/lib/auth/rbac.ts](../../../src/lib/auth/rbac.ts)) ist die Matrix, wird aber nur im Client genutzt.
- [server-auth.ts](../../../src/lib/supabase/server-auth.ts) löst Kanzlei (`resolveSessionOrganizationId`) und Rolle (`resolveSessionActor`) aus der Mitgliedschaft auf. Eine angefragte Kanzlei gilt nur bei Mitgliedschaft; ohne Angabe wird die erste Mitgliedschaft genommen. Mehrfachmitgliedschaft ist damit möglich.
- Routen prüfen heute Mitgliedschaft, nicht die Aktion (z. B. `DELETE /api/documents`).
- `rls_documents_all` ist rollenblind; die Mitgliedschafts-Policy (SEC-01) ist bereits auf NOTAR/ADMIN beschränkt.

## Entscheidungen

1. Matrix bleibt einzige Quelle (`ROLE_PERMISSIONS`); der Server ruft `hasPermission` auf, keine zweite Logik.
2. Rolle wird je Request aus `organization_members` gelesen (kein JWT-Claim): Rollenwechsel wirken sofort.
3. Header/Query `organizationId` ist nur Auswahl unter eigenen Mitgliedschaften, nie Berechtigung.
4. Verweigerte Aktionen (403) erzeugen ein append-only Audit-Ereignis `ACCESS_DENIED` über die bestehende Hash-Kette.

## Komponenten

### Vertrag (`src/types/auth.ts`)

- `SessionContext = { userId, organizationId, role: NotaryRole, actorLabel }` als Zod-Schema.
- `ACCESS_DENIED` im Audit-Ereignis-Enum; Payload: Aktion, Route, Rolle.

### Guard (`src/lib/auth/require-permission.ts`)

`requirePermission(supabase, action, requestedOrgId?) -> Promise<SessionContext>`

- Kein Nutzer oder keine (passende) Mitgliedschaft: wirft `AuthzError` Status 401.
- `hasPermission` false: schreibt `ACCESS_DENIED`, wirft `AuthzError` Status 403.
- Baut auf `resolveSessionOrganizationId`/`resolveSessionActor` auf; diese bleiben die Primitive.
- DB-Fehler werden geworfen (Fail-Fast), nie als „nicht berechtigt“ verschluckt.

### Routen (dünne Adapter)

Der Guard läuft als erster Schritt. Aktionszuordnung:

| Route                                                                             | Aktion                   |
| --------------------------------------------------------------------------------- | ------------------------ |
| `DELETE /api/documents`, `DELETE /api/jobs/[id]`                                  | `DELETE_DOSSIER`         |
| `PUT /api/analyze` (Freigabe)                                                     | `FINAL_APPROVAL`         |
| `PUT /api/analyze` (Statusänderung Feld)                                          | `OVERRIDE_FIELD_STATUS`  |
| `POST /api/team`, `PATCH`/`DELETE /api/team/[id]`, `POST`/`PUT /api/organization` | `MANAGE_TEAM`            |
| `POST /api/storage/upload-url`, `POST /api/jobs`, `POST /api/analyze`             | `UPLOAD_DOCUMENTS`       |
| Export-Routen (sofern vorhanden)                                                  | `EXPORT_OFFICIAL_REPORT` |
| Lesende Routen                                                                    | nur Mitgliedschaft       |

Zuordnung wird beim Plan gegen die tatsächlichen Handler abgeglichen. `actor`/`actorRole` stammen nur aus `SessionContext`.

### RLS (in `supabase/migrations/20260915000000_core_multi_tenancy.sql`)

- `rls_documents_all` aufteilen: SELECT/INSERT/UPDATE für Mitglieder; DELETE nur für Rollen mit `DELETE_DOSSIER`.
- `audit_logs` INSERT erlaubt `ACCESS_DENIED` für jedes Mitglied.
- Rollenliste in SQL spiegelt die Matrix; ein Konsistenztest vergleicht sie mit `ROLE_PERMISSIONS`.
- Live-Anwendung nur mit Zustimmung; sonst `DECLARATION_STAGED` mit offenem Punkt im DoD.

## Tests (TDD)

- Matrix Rolle × Aktion × Route: 401/403/200.
- Gefälschter `x-organization-id` einer fremden Kanzlei und Body-Akteur bleiben wirkungslos.
- 403 erzeugt genau ein `ACCESS_DENIED`; DB-Fehler erzeugt 500, nicht 403.
- SQL/Matrix-Konsistenz; DB-Harness: Sachbearbeiter kann per RLS kein Dossier löschen.
- Je Schutz: Entfernen des Schutzes macht mindestens einen Test rot.

## Nicht in diesem Zyklus

Rollen im JWT, Rechte-Editor in der UI, Löschpipeline, Observability, Kostenerfassung.

## Dokumentation

`docs/overview.md` (Abschnitt Autorisierung), `ROADMAP.md`, `CHANGELOG.md` im selben Changeset.
