# ADR 0004: Fachregeln als Daten in `knowledge_documents`

**Status:** Angenommen (rückwirkend dokumentiert)

## Kontext

Gesetze, Fristen und Kanzleistandards ändern sich und müssen fachlich geprüft werden. Als Konstanten im Anwendungscode wären sie weder versionierbar noch mit Gültigkeit und Prüfstatus versehen.

## Entscheidung

Materielle Rechtsregeln, Fristen und Kriterien liegen ausschließlich als Zeilen in `knowledge_documents` (AGENTS.md, Invarianten 5 und Abschnitt 1). Jede Zeile trägt Fundstelle, Gültigkeitszeitraum, Version und Prüfstatus (`UNGEPRUEFT`, `GEPRUEFT`, `ZURUECKGEZOGEN`); Suche und Prompt-Einbindung liefern nur heute gültige, nicht zurückgezogene Einträge ([ARCHITECTURE.md](../ARCHITECTURE.md), Abschnitt 1.6). Der Code enthält nur Mechanik (Auswahl, Ranking, Prompt-Format).

## Folgen

- Fachliche Änderungen sind Datenänderungen mit Prüfstatus statt Codeänderungen.
- Die Seed-Bestände sind `UNGEPRUEFT`, bis eine fachkundige Person sie freigibt.
- Tests und Fixtures dürfen Beispielwerte enthalten, Anwendungscode nicht; `npm run audit` prüft Magic Strings, die Eval-Gates messen die Trefferqualität der Regelauswahl.

## Verworfene Alternativen

Regeln als Konstanten oder als bedingte Logik im Code (`if/else`-Bäume). AGENTS.md verbietet das ausdrücklich.
