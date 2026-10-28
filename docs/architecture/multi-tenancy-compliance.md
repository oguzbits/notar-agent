# Mandantenfähigkeit & Kanzlei-Isolation (§ 203 StGB)

> **Architektur-Spezifikation:** Kernel-Level Row-Level Security & Revisionssicherheit  
> **Kernkomponenten:** PostgreSQL RLS, `audit_logs`, `src/types/organization.ts`, `src/lib/auth/rbac.ts`

---

## 1. Das berufsrechtliche Gebot der strikten Trennung

Notariate unterliegen der berufsrechtlichen Verschwiegenheitspflicht (§ 18 BNotO) und dem strafbewehrten Berufsgeheimnis (§ 203 StGB). In einem mandantenfähigen Cloud-Setup darf unter keinen Umständen ein Datenabfluss zwischen verschiedenen Kanzleien (Tenants) oder innerhalb einer Sozietät bei Mandatskonflikten möglich sein.

---

## 2. Row-Level Security (RLS) im PostgreSQL Kernel

Statt Mandantentrennung fehleranfällig im TypeScript-Applikationscode zu verwalten, erzwingt die Architektur **Row-Level Security (RLS)** direkt auf Datenbank-Kernel-Ebene:

```sql
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON dossiers
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
```

- Alle Tabellen besitzen zwingend eine Fremdschlüssel-Beziehung zu `organizations`.
- Supabase SSR Sessions lösen die Identität des Kanzleimitglieds serverseitig auf. Spoofbare Client-IDs sind verboten.

---

## 3. Rollen- und Rechtematrix (Kanzlei-RBAC)

| Rolle                         | Typische Person         | Berechtigungen im System                                                                                                                       |
| :---------------------------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **`NOTAR` / `NOTARASSESSOR`** | Amtsträger              | Vollzugriff: Letztentscheidung über Freigaben, finale Status-Overrides, Export in Fachverfahren, Einsicht in unveränderliche Audit-Logs.       |
| **`SACHBEARBEITER`**          | Notarfachangestellte(r) | Operativer Zugriff: Akten-Upload, Klärung von `NEEDS_REVIEW`, Einpflegen von Notizen und Nachträgen, Begründung von Warnungen.                 |
| **`ANWALTSNOTAR_RA`**         | Partner / RA            | Selektiver Zugriff: Nur Einsicht in Akten ohne Mandatskonflikte (§ 43a BRAO).                                                                  |
| **`ADMIN`**                   | Kanzlei-Administrator   | Technischer Zugriff: Mitarbeiter-Einladungen, Rollenzuweisungen, Schnittstellenanbindung – kein Einblick in Mandantenakten ohne Audit-Eintrag. |

---

## 4. Revisionssicherer Audit-Trail (§ 17 ff. BeurkG)

- **Append-Only Event-Tabelle:** `audit_logs` protokolliert jede Modifikation (Status-Overrides, Exporte, Berechtigungsänderungen).
- **Kryptografische Integrität:** Jeder Datensatz ist über SHA-256 mit dem Hash des Vorgängers verkettet (Hash-Chaining).
- **Zwingende Begründung:** Jeder manuelle Statuswechsel an einem Feld braucht eine Begründung (`auditOverride`); ohne sie lehnt `PUT /api/analyze` mit 400 ab und speichert nichts. Die Begründung gilt nur für genau das begründete Feld und den angegebenen Zielstatus; den bisherigen Status bestimmt der Server aus dem gespeicherten Stand.
- **Teamänderungen:** Rollenwechsel und Entfernen werden in der Kette `team:<Kanzlei>` festgehalten (Akteurrolle, Ziel, alte und neue Rolle). Den Eintrag `MEMBER_ROLE_CHANGED` schreibt der Trigger `organization_members_audit_role` in derselben Transaktion wie die Rollenänderung (scheitert er, wird die Rolle zurückgenommen; ohne handelnden Nutzer, also Servicekonto und Kaskaden, entsteht keiner). `MEMBER_REMOVED` schreibt weiter [`team-service.ts`](../../src/lib/team/team-service.ts) nach dem Löschen, nicht atomar (Schlägt er fehl, antwortet die Route mit 500, die Entfernung bleibt bestehen). `MEMBER_INVITED` ist für den künftigen Einladungsweg reserviert (`POST /api/team` antwortet bis dahin mit 501). Die Insert-Policy lässt die Kette nur für die eigene Kanzlei zu.
- **Kanzleibesetzung in der Datenbank:** Angemeldete Nutzer dürfen an einer Mitgliedschaft nur die Rolle ändern (`GRANT UPDATE (role)`); Verschieben in eine andere Kanzlei oder Umschreiben auf einen anderen Nutzer scheitert an der Spaltenberechtigung (`42501`). Der Trigger `organization_members_guard` lehnt die Änderung oder Entfernung der eigenen Mitgliedschaft ab (eigener SQLSTATE `TM001`, API 403) und verhindert, dass die Kanzlei ihren letzten `NOTAR` verliert (`TM002`, API 409). Diese beiden Codes und `42501` (RLS, z. B. `ADMIN` vergibt `NOTAR`, API 403 mit fester Meldung) deutet [`team-repository.ts`](../../src/lib/team/team-repository.ts) fachlich; die Teamverwaltung bietet `NOTAR` nur einem `NOTAR` zur Auswahl an. Andere Datenbankfehler bleiben technische Fehler. Ein Advisory-Lock je Kanzlei serialisiert parallele Änderungen, sodass zwei gleichzeitige Herabstufungen nicht beide gelingen. Die Rolle `NOTAR` vergibt nur ein `NOTAR`: Die Policies `rls_org_members_insert` und `rls_org_members_update` lassen einem `ADMIN` nur Mitgliedschaften anderer Rollen zu (sonst `42501`), die erste Mitgliedschaft entsteht in `create_new_organization`. Servicekonto (`auth.uid()` leer) und Kaskaden (`pg_trigger_depth() > 1`, z. B. Kanzlei oder Konto löschen) bleiben unberührt, auch wenn eine Kaskade in einer angemeldeten Sitzung ausgelöst wird.

## 5. Löschpipeline & Pseudonyme im Audit-Trail

- **Transaktionale Löschung:** Die Datenbankfunktion `delete_dossier(document_id, reason)` prüft die Rolle selbst (NOTAR, NOTARASSESSOR, ADMIN; Nichtmitglieder erhalten „nicht gefunden“), lehnt Dossiers mit laufender Verarbeitung ab und entfernt Dossier, Jobs, Workflow-Instanzen und Pseudonym-Zuordnungen in einer Transaktion. Der Löschgrund ist eine feste Auswahl (`DELETION_REASONS`), kein Freitext.
- **Outbox für Storage:** Dateien (aus `dossier_jobs.payload` und dem Archivordner) werden als `deletion_tasks` vorgemerkt, nur Pfade der eigenen Kanzlei. Nach dem Löschen räumt `DELETE /api/documents` die Dateien genau dieser Akte sofort ab (`after()`, Service-Role erst nach der Rechteprüfung und auf die `document_id` begrenzt). `GET /api/cron/deletion` (Bearer `CRON_SECRET`, Service-Role) läuft täglich über alle Aufgaben, wiederholt Fehler bis zum Höchstversuch und markiert dauerhaft fehlgeschlagene Aufgaben als `FAILED`. Derselbe Lauf räumt beendete Vorgänge (`dossier_jobs`: abgeschlossen, abgebrochen oder fehlgeschlagen ohne weitere Wiederholung) samt ihren Dateien nach 7 Tagen ab (`pruneCompletedJobs`, höchstens 100 je Lauf); wartende und laufende Vorgänge bleiben unberührt. Entfernt werden nur Upload-Pfade der Form `<Kanzlei>/<Datei>` der eigenen Kanzlei (`isOwnUploadPath`); Pfade aus Client-Eingaben mit anderem Präfix, `archive/` oder `..` bleiben unberührt (Warnung im Log), und `POST /api/analyze` lehnt solche Pfade mit 400 ab. Schlägt das Entfernen der Dateien fehl, bleibt die Zeile bestehen. Die Vorgangsübersicht (`listJobs`) liefert höchstens 100 Vorgänge ohne Dateiinhalte und Zwischenergebnisse.
- **Nachweis in der Kette:** `DOSSIER_DELETED` (Akteur, Grund, gelöschte Zeilen je Tabelle, Anzahl Storage-Aufgaben) und nach der letzten erledigten Aufgabe `DOSSIER_PURGE_COMPLETED` (`complete_dossier_purge`, einmalig).
- **Pseudonyme statt Personenbezug:** Der Trigger der Kette schreibt je (Akte, Nutzer) ein Pseudonym (`audit_actor_map.actor_ref`) und lässt `actor_id` leer; gehasht wird nur das Pseudonym. Klarnamen stehen in der löschbaren Zuordnung. Mit dem Löschen des Dossiers entfällt sie, die Kette bleibt gültig.
- **Aufbewahrungsfristen als Daten:** `knowledge_documents.retention_years` (geprüfte, gültige Einträge, längste Frist gilt) und `documents.retention_anchor_at`. `list_retention_expired_dossiers` ermittelt fällige Dossiers in PostgreSQL, `delete_dossier_system` löscht sie. Ohne Fristeintrag oder Anker wird nie automatisch gelöscht.
- **Wächter gegen Umgehung der Routen:** Die Datenbank-Schnittstelle ist mit der Sitzung jedes Mitglieds erreichbar, also auch an den Routenprüfungen vorbei. `documents_guard_review` (BEFORE INSERT/UPDATE auf `documents`) erlaubt das Setzen oder Ändern eines Prüfvermerks nur Rollen mit `OVERRIDE_FIELD_STATUS` (Spiegel der Matrix, geprüft in [`rbac-sql-parity.test.ts`](../../src/lib/auth/rbac-sql-parity.test.ts)); ein unverändert mitgeführter Vermerk bleibt für alle Mitglieder erlaubt, das Entfernen ebenso (die Analyse verwirft ihn bei geänderten Daten). `dossier_jobs_guard_checkpoint` lehnt einen neuen Job mit `stage1Output` ab; der Server-Worker schreibt den Checkpoint per UPDATE. Ohne Sitzung (Service-Rolle, Cron) greifen beide nicht. Restrisiko: Status, Daten und Audit-Einträge kann ein Mitglied direkt weiter schreiben, weil Analyse und Fälschung für die Datenbank gleich aussehen; das schließt nur ein Schreiben ausschließlich über die Service-Rolle. Die Szenarien liegen in [`scripts/db/guard-scenarios.sql`](../../scripts/db/guard-scenarios.sql).
- **Grenzen:** Freitext in `note`, `override.reason` und `caseTitle` kann Personenbezug enthalten und bleibt in der Kette. Ob Pseudonymisierung den notariellen Aufbewahrungs- und Löschpflichten genügt, ist rechtlich offen.
