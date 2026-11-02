# Betriebs-Runbook

> **Zweck:** Was bei Störung, Fehldeploy oder Datenverlust zu tun ist, und was heute (Stand 02.11.2026) _nicht_ abgesichert ist. Offene Aufgaben stehen in [ROADMAP.md](../ROADMAP.md) (C.7). Plattformangaben stammen aus der Anbieter-Dokumentation vom 02.11.2026 und sind vor einer Zusage an Kunden gegenzuprüfen.

## 1. Was läuft wo

| Baustein                 | Dienst                                              | Region                                                                                                  |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| App und API (Funktionen) | Vercel; `main` deployt in Produktion                | Frankfurt (`fra1`, [vercel.json](../../vercel.json)); davor galt die Standardregion `iad1` (Washington) |
| Datenbank, Auth, Dateien | Supabase, Projekt „Notar-Partner-Prototyp“          | `eu-central-1`                                                                                          |
| Fehlerbericht            | Sentry, nur mit gesetztem DSN                       | EU (Frankfurt)                                                                                          |
| Löschlauf                | Vercel Cron `/api/cron/deletion`, täglich 03:00 UTC | gesichert über `CRON_SECRET`                                                                            |
| Erreichbarkeit           | `GET /api/health` (200 `ok`, 503 `fehler`)          | prüft eine RLS-geschützte Abfrage, ohne Details                                                         |

## 2. Störung erkennen

- **Heute:** Ein Ausfall fällt nur auf, wenn jemand die Seite öffnet oder Sentry einen Fehler meldet. Es gibt keinen externen Erreichbarkeits-Check und keine Alarmregel (offen, ROADMAP C.7).
- **Sentry-Alarm einrichten:** Sentry → Alerts → Create Alert → _Issues_, Auslöser „A new issue is created“, Aktion E-Mail an die Betreiberin oder den Betreiber, Drosselung nach Bedarf. Im Free-Plan sind E-Mail-Benachrichtigungen enthalten, Integrationen wie Slack nicht.
- **Erreichbarkeit:** Ein externer Dienst, der `GET /api/health` im Minutentakt aufruft und bei 503 oder Zeitüberschreitung alarmiert, schließt die Lücke. Dafür ist ein Konto bei einem Anbieter nötig (bewusst noch nicht angebunden).

## 3. Fehldeploy zurücknehmen

1. Vercel → Projekt → _Deployments_ → letztes gutes Deployment → _Instant Rollback_. Auf dem Hobby-Plan geht das nur auf das unmittelbar vorherige Deployment, auf Pro auf jedes frühere Production-Deployment.
2. Nach einem Rollback wird ein neuer Push nicht automatisch live. Wieder freigeben mit _Undo Rollback_ oder `vercel promote <Deployment>`.
3. Danach den Fehler mit `git revert <Commit>` beheben (nie Historie umschreiben) und normal deployen.
4. **Datenbank-Migrationen laufen nicht mit zurück.** Eine Migration muss deshalb so geschrieben sein, dass der vorherige Code damit weiterläuft; ist das nicht möglich, wird die Migration vor dem Code eingespielt und der Code erst danach gepusht (siehe Hinweis zu Migrationen in [AGENTS.md](../../AGENTS.md)).

## 4. Datensicherung und Wiederherstellung

**Stand:** Das Supabase-Projekt läuft im Free-Plan. Dort gibt es keine automatischen Backups, kein Point-in-Time-Recovery und kein Branching. Eine Wiederherstellung nach Datenverlust ist damit **nicht möglich**, solange keine eigene Sicherung existiert. RPO und RTO sind nicht definiert.

- **Manuelle Sicherung (Übergang):** `supabase db dump --db-url "<Verbindungs-URL aus dem Supabase-Dashboard>" -f sicherung.sql`. Die Datei enthält Mandantendaten, wird verschlüsselt abgelegt und nie in das Repository gelegt. Dateien im Speicher (Storage) sind darin nicht enthalten.
- **Mit Pro-Plan:** tägliche Backups mit 7 Tagen Aufbewahrung; Point-in-Time-Recovery ist ein kostenpflichtiges Zusatzpaket (7, 14 oder 28 Tage). Wiederherstellung über _Database → Backups_; das Projekt ist währenddessen nicht erreichbar.
- **Restore-Test:** Ein Backup zählt erst, wenn die Wiederherstellung einmal erfolgreich durchgespielt wurde. Dieser Test ist offen (ROADMAP C.7) und hängt an der Planentscheidung.

## 5. Vorfall mit Mandantendaten

1. Eindämmen: Fehldeploy zurücknehmen (Abschnitt 3); bei Verdacht auf Zugriff Schlüssel rotieren (Supabase-Service-Key, `CRON_SECRET`, KI-Schlüssel) und Sitzungen beenden.
2. Umfang feststellen: Audit-Trail (`audit_logs`, Hash-Kette) und Sentry auswerten; die Kette weist Manipulationen nach.
3. Melden: Die Meldefrist an die Aufsichtsbehörde bei Datenpannen nach Art. 33 DSGVO beträgt 72 Stunden ab Kenntnis; Berufsgeheimnisträger (§ 203 StGB) klären Mandantenmitteilung und Meldung gemeinsam mit der Datenschutzberatung. Das Runbook ersetzt keine Rechtsberatung.
4. Nachbereiten: Ursache im [CHANGELOG.md](../CHANGELOG.md) festhalten, Lücke in ROADMAP oder Test schließen.

## 6. Löschlauf prüfen

Vercel → Projekt → _Cron Jobs_ zeigt den letzten Lauf von `/api/cron/deletion`. Fehlt `CRON_SECRET`, antwortet die Route mit 401. Der Lauf räumt abgeschlossene, abgebrochene und fehlgeschlagene Vorgänge nach sieben Tagen auf und löscht fällige Dossiers nach den Aufbewahrungsfristen ([job-orchestration.md](../architecture/job-orchestration.md), [multi-tenancy-compliance.md](../architecture/multi-tenancy-compliance.md)).
