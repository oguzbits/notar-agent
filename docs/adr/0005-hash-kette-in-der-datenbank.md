# ADR 0005: Audit-Hash-Kette per Datenbank-Trigger

**Status:** Angenommen (rückwirkend dokumentiert)

## Kontext

Übersteuerungen, Exporte und Rollenwechsel müssen nachvollziehbar und nicht nachträglich veränderbar sein (§ 17 BeurkG). Ein Eintrag, den der Client oder die Anwendung selbst verkettet, ließe sich über andere Wege (Servicekonto, direkter Datenbankzugriff) umgehen.

## Entscheidung

Ein `BEFORE INSERT`-Trigger in PostgreSQL vergibt je Akte unter Advisory-Lock Sequenznummer, Vorgänger-Hash, Zeitstempel, Akteur-Pseudonym und SHA-256-Hash; vom Client gelieferte Werte werden überschrieben. Update, Delete und Truncate sind per Trigger gesperrt, auch für das Servicekonto. `verify_audit_chain(document_id)` prüft die Kette in SQL ([multi-tenancy-compliance.md](../architecture/multi-tenancy-compliance.md), Abschnitte 4 und 5).

## Folgen

- Parallele Einträge können die Kette nicht verzweigen; die Anwendung kann sie nicht umschreiben.
- Der Akteur steht als Pseudonym in der Kette; die Zuordnung entfällt mit dem Vorgang (Löschpipeline).
- Ein externer Zeitstempelanker fehlt noch. Ohne ihn beweist die Kette Konsistenz, nicht den Zeitpunkt gegenüber Dritten.
- `audit-crypto.ts` bleibt als Testdouble für die In-Memory-Variante.

## Verworfene Alternativen

Verkettung in der Anwendung (Repository) wäre ohne Datenbank-Sperren umgehbar und konkurrenzanfällig.
