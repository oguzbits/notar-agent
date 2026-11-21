---
covers:
  - src/lib/jobs/
  - vercel.json
---

# Skalierung und Job-Queue

> **Zweck:** Wo die Verarbeitung heute an Grenzen stößt, woran man den Zeitpunkt für eine echte Warteschlange erkennt und welche Bausteine dafür auf dem aktuellen Supabase-Plan verfügbar sind. Offene Aufgaben stehen in [ROADMAP.md](../ROADMAP.md) (B.9). Stand: 21.11.2026; Plattformangaben sind vor einer Zusage an Kunden gegenzuprüfen.

## 1. Heutiger Ablauf

Eine Hintergrund-Analyse legt eine Zeile in `dossier_jobs` an. Danach läuft der Worker über `after()` in derselben Vercel-Funktion weiter ([ADR 0001](../adr/0001-hintergrundverarbeitung-mit-after.md), [job-orchestration.md](../architecture/job-orchestration.md)). Ein Prüfpunkt nach Stufe 1 und die Heilung verwaister Vorgänge fangen Abbrüche auf.

| Grenze                    | Heute                                                                          | Folge                                                           |
| :------------------------ | :----------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| Laufzeit der Funktion     | `maxDuration = 60` in `src/app/api/analyze/route.ts`                           | Eine Analyse darf nicht länger als die Funktionslaufzeit dauern |
| Gleichzeitige Läufe       | Keine zentrale Steuerung; je Kanzlei 30 Aufträge pro Stunde (`JOB_RATE_LIMIT`) | Lastspitzen belasten das Modellkontingent direkt                |
| Wiederanlauf nach Abbruch | Heilung nach 3 Minuten ohne Fortschritt, im Cron und beim Laden der Liste      | Ein Vorgang wartet bis zur nächsten Heilung                     |
| Planmäßige Wiederholung   | Nur der tägliche Löschlauf (`vercel.json`)                                     | Keine feiner getaktete Abarbeitung                              |

## 2. Auslöser für eine echte Warteschlange

Die Warteschlange wird gebaut, wenn mindestens eines davon in den Lastdaten aus B.9 sichtbar ist:

1. Analysen brechen wegen der Funktionslaufzeit ab, obwohl der Prüfpunkt greift.
2. Gleichzeitige Läufe überschreiten das Modellkontingent und führen zu wiederholten 429-Antworten des Anbieters.
3. Die Heilung verwaister Vorgänge greift in mehr als einem kleinen Teil der Läufe.

Ohne diese Daten wäre die Queue eine Abstraktion auf Vorrat (AGENTS.md, Pragmatic YAGNI).

## 3. Verfügbare Bausteine (Supabase-Projekt, geprüft am 21.11.2026)

Quelle: `list_extensions` am Projekt und die Supabase-Dokumentation (Cron, `pg_net`, Edge-Functions-Limits).

| Baustein              | Stand im Projekt                   | Bedeutung                                                                                   |
| :-------------------- | :--------------------------------- | :------------------------------------------------------------------------------------------ |
| `pg_net`              | aktiv (0.20.4)                     | Datenbank kann HTTP-Aufrufe absetzen (nur POST mit JSON, höchstens 200 Anfragen je Sekunde) |
| `pg_cron`             | verfügbar (1.6.4), nicht aktiviert | Minütliche oder feinere Takte; Aufträge sollten höchstens 10 Minuten laufen                 |
| `pgmq`                | verfügbar (1.5.1), nicht aktiviert | Warteschlange in PostgreSQL mit Sichtbarkeitsfrist und Wiederholung                         |
| Edge Functions (Free) | Wanduhr 150 s, CPU 2 s je Anfrage  | Reicht für Anstoßen und Verteilen, nicht für lange Modellläufe am Stück                     |

Die Dokumentation nennt keine Einschränkung von `pg_cron` oder `pg_net` auf einen bezahlten Plan. Ob die Aktivierung auf dem Free-Plan ohne Einschränkung gelingt, ist erst beim Einspielen der Migration belegt.

## 4. Mögliche Zielbilder

| Variante                                    | Prinzip                                                                     | Offener Punkt                                                         |
| :------------------------------------------ | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| `pg_cron` + `pg_net` ruft eine Vercel-Route | Takt holt wartende Vorgänge ab und stößt je Vorgang eine eigene Funktion an | Geheimnis für den Aufruf im Vault; Laufzeit je Funktionsaufruf bleibt |
| `pgmq` als Warteschlange                    | Vorgänge als Nachrichten, Wiederholung über Sichtbarkeitsfrist              | Zweite Wahrheit neben `dossier_jobs`, Abgleich nötig                  |
| Eigener Worker-Host                         | Dauerhafter Prozess holt Vorgänge ab                                        | Laufende Kosten und Betrieb                                           |

Die erste Variante verändert am wenigsten: `dossier_jobs` bleibt die einzige Quelle, `transitionJob` sichert den Zugriff ab ([job-claim.db.test.ts](../../src/test/db/job-claim.db.test.ts)). Die Entscheidung fällt nach B.9 und wird dann als ADR festgehalten.
