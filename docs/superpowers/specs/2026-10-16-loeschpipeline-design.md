# Löschpipeline – Design

Stand: 2026-10-16. Status: Entwurf, Chat-Design freigegeben (Ansatz 1); Spec zur Prüfung.

## Ziel

Das Löschen eines Dossiers entfernt alle zugehörigen Daten vollständig und nachweisbar. Jede Löschung erzeugt
einen Eintrag in der Hash-Kette mit Akteur, Zeitpunkt, Grund und Umfang. Aufbewahrungsfristen sind Daten
(`knowledge_documents`), nicht Code. Nach Fristablauf löscht dieselbe Pipeline automatisch.

## Ausgangslage

- `DELETE /api/documents` löscht über `deleteDossierRecord` nur die Zeile in `documents`. Rollenprüfung
  (`DELETE_DOSSIER`) und RLS-Löschrecht bestehen.
- Abhängige Daten (`dossier_jobs` über `result_dossier_id`, `workflow_instances`, Storage-Objekte im Bucket
  `dossier-files`, Vektor-Chunks) werden nicht gezielt mitgelöscht; `dossier_jobs.result_dossier_id` ist TEXT ohne
  Fremdschlüssel.
- `audit_logs` ist append-only (Trigger), `document_id` TEXT ohne Fremdschlüssel; `actor` und `details` enthalten
  Personenbezug.
- Offen, vor Umsetzung per Code-Lesen zu klären: Zuordnung Dossier → Storage-Pfade und Chunk-Tabellen.

## Entscheidungen

1. Löschen läuft als Datenbankfunktion `delete_dossier(p_document_id, p_reason)` in einer Transaktion; die Route
   ist ein dünner Adapter (Zod, Auth, Delegation).
2. Storage-Objekte werden nicht in der Transaktion gelöscht, sondern über `deletion_tasks` (Outbox) von einem
   Cron-Job entfernt. Fehlgeschlagene Aufgaben werden wiederholt; ein Dossier gilt erst als vollständig gelöscht,
   wenn alle Aufgaben `DONE` sind.
3. Der Löschnachweis ist ein Ereignis `DOSSIER_DELETED` in der Hash-Kette (Akteur, Grund, Anzahl gelöschter Zeilen
   je Tabelle, Anzahl Storage-Aufgaben). Der Abschluss der Storage-Löschung wird als `DOSSIER_PURGE_COMPLETED`
   nachgetragen.
4. Aufbewahrungsfrist: Datensatz in `knowledge_documents` (Kategorie KANZLEI_RICHTLINIE bzw. gesetzliche Norm),
   gelesen über `IKnowledgeRepository`. Kein Fristwert im Code. Ohne Fristdatensatz löscht der Automatismus nicht
   (fail-closed); manuelles Löschen bleibt möglich.
5. Fristgesteuertes Löschen nutzt `delete_dossier` mit Akteur `SYSTEM` und Grund `RETENTION_EXPIRED`.

## Pseudonymisierung im Audit-Log (ADR-Kandidat)

Problem: Die Kette hasht `actor`, `actor_id`, `details`. Nachträgliches Ändern bricht die Verifikation und
widerspricht dem Append-only-Trigger.

Entscheidung: Personenbezug wird nicht in die Kette geschrieben, sondern als Pseudonym (`actor_ref`, zufällige ID)
mit Zuordnung in der Tabelle `audit_actor_map` (außerhalb der Kette, löschbar). Beim Löschen eines Dossiers
entfällt die Zuordnung für dessen Einträge; die Kette bleibt gültig, der Personenbezug ist nicht mehr herstellbar.
Freitext-Namen in `details` werden nicht mehr geschrieben (Allowlist-Schema je Ereignis in `src/types/`).

Rechtlich offen (Bestandsaufnahme C-06 bis C-10): Ob Pseudonymisierung statt Löschung der Kettendaten genügt und
wie sie sich zu notariellen Aufbewahrungspflichten verhält. Die Umsetzung hängt daran, bis das fachlich
entschieden ist; die Spec legt nur den technischen Mechanismus fest.

## Komponenten

- **Vertrag (`src/types/`):** Zod-Schemas für `DeletionReason`, `DeletionReceipt`, `DeletionTask`, Audit-Ereignisse
  `DOSSIER_DELETED`, `DOSSIER_PURGE_COMPLETED`; keine Logik.
- **Migration (in `core` bzw. `workflows` konsolidiert):** `deletion_tasks`, `audit_actor_map`, Funktion
  `delete_dossier` (SECURITY DEFINER, prüft `get_user_role` selbst), RLS auf beiden Tabellen,
  Index auf `deletion_tasks(status, created_at)`.
- **`src/lib/dossier/` (Mechanismus):** reine Funktion zur Fristberechnung aus Fristdatensatz + Beurkundungsdatum.
- **Repository:** `deleteDossierRecord` ruft die RPC auf, wirft bei Fehler (fail-fast), gibt `DeletionReceipt` zurück.
- **Route:** `DELETE /api/documents` verlangt Grund im Body, liefert Nachweis.
- **Worker:** Route `POST /api/cron/deletion` (geschützt über Cron-Secret) arbeitet `deletion_tasks` ab und
  erkennt abgelaufene Fristen.
- **UI:** Löschdialog mit Pflichtgrund (vorhandenes `ConfirmDialog`), 4 Zustände, Hinweis „Löschung läuft“,
  solange Aufgaben offen sind. Texte aus `src/lib/dossier/constants.ts`.

## Tests (Liste)

1. SACHBEARBEITER löscht → abgelehnt, Zeile bleibt (RLS und Funktion).
2. NOTAR löscht → Dossier, Jobs, Workflow-Instanzen weg; `deletion_tasks` für alle Storage-Objekte angelegt.
3. Kette nach Löschung gültig (`verify_audit_chain`); `DOSSIER_DELETED` enthält Umfang und Grund.
4. Löschen ohne Grund → 400.
5. Storage-Fehler → Aufgabe bleibt `PENDING`, Wiederholung; nach Erfolg `DOSSIER_PURGE_COMPLETED`.
6. Mandantenisolation: Löschen eines fremden Dossiers → keine Wirkung.
7. Fristlogik: ohne Fristdatensatz kein Automatismus; mit abgelaufener Frist wird gelöscht.
8. Pseudonymisierung: nach Löschung ist die Zuordnung in `audit_actor_map` weg, Kette weiter gültig.

Schutzfunktion → Test, der ohne sie rot wird: Rollenprüfung in `delete_dossier` → Test 1; Mandantenfilter → Test 6;
fail-closed bei fehlender Frist → Test 7; Outbox-Wiederholung → Test 5.

## Außerhalb des Umfangs

Rechte-Editor in der UI, Löschanfragen Betroffener, Observability, Kostenerfassung, Backups/Point-in-Time-Recovery
(Aufbewahrung dort gesondert zu regeln), Live-Anwendung der Migration (vorerst `DECLARATION_STAGED`).

## Dokumentation

Bei Umsetzung: `docs/architecture/multi-tenancy-compliance.md` und `docs/overview.md` ergänzen, Eintrag in
`ROADMAP.md` und `CHANGELOG.md`.
