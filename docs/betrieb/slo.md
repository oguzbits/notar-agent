# Dienstgüteziele (SLO)

> **Zweck:** Woran die Verfügbarkeit und Qualität der Analyse gemessen wird, welche Messpunkte es heute gibt und wo noch keine. Die Zielwerte sind Vorschläge für die Betreiberin oder den Betreiber, keine zugesagten Werte; vor einer Zusage an Kunden entscheiden und eintragen. Betriebsablauf: [runbook.md](runbook.md); Grenzen und Queue: [skalierung.md](skalierung.md). Stand: 21.11.2026.

## 1. Ziele

| Nr  | Ziel (Indikator)                                                                | Vorschlag  | Messpunkt heute                                                                       | Lücke                                              |
| :-- | :------------------------------------------------------------------------------ | :--------- | :------------------------------------------------------------------------------------ | :------------------------------------------------- |
| 1   | Erreichbarkeit der Anwendung (Anteil erfolgreicher Antworten von `/api/health`) | 99,5 %     | `/api/health` liefert 200 oder 503 mit minimaler Antwort; kein externer Aufrufer      | Externer Erreichbarkeits-Check fehlt (ROADMAP C.7) |
| 2   | Hintergrund-Analyse endet erfolgreich (Anteil `COMPLETED` an beendeten Läufen)  | 95 %       | `dossier_jobs.status` je Kanzlei und Zeitraum, per SQL auswertbar                     | Keine Auswertung und kein Alarm                    |
| 3   | Dauer einer Analyse (Median und 95. Perzentil von Anlage bis Abschluss)         | offen      | `dossier_jobs.created_at` bis `updated_at` der abgeschlossenen Läufe                  | Ziel erst nach Lastdaten aus B.9 sinnvoll          |
| 4   | Fehler je Anfrage (Anteil 5xx der API-Antworten)                                | 1 %        | Sentry-Berichte und strukturierte Logs mit `requestId`                                | Keine Zählung der erfolgreichen Anfragen           |
| 5   | Belegtreue (Anteil von Angaben, die der Abgleich verwirft)                      | beobachten | Zusammenfassung der Verwerfungsgründe im Log je Lauf (`verifikation_zusammenfassung`) | Zielwert nur mit echten Akten sinnvoll             |

## 2. Fehlerbudget

Bei 99,5 % Erreichbarkeit im Monat bleiben rund 3,6 Stunden Ausfall. Ist das Budget aufgebraucht, haben Stabilitätsaufgaben (ROADMAP C.7, B.9) Vorrang vor neuen Funktionen.

## 3. Was fehlt, bevor die Ziele belastbar sind

- Externer Erreichbarkeits-Check für `/api/health` mit Benachrichtigung.
- Sentry-Alarm bei neuen Fehlern ([runbook.md](runbook.md), Abschnitt zur Alarmierung).
- Eine wiederkehrende Abfrage für Ziel 2 und 3 (SQL über `dossier_jobs`), Auswertung zunächst von Hand.
- Eintrag der vereinbarten Werte in dieser Datei.
