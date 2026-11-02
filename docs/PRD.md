# Notar Agent — Produktanforderungen

> **Zweck:** Was gebaut wird und für wen. Das Wie steht in [docs/overview.md](overview.md), die Regeln in [AGENTS.md](../AGENTS.md), die offenen Aufgaben in [ROADMAP.md](ROADMAP.md).

## Problem

Vor der Beurkundung eines Immobilienkaufvertrags liegen im Notariat unstrukturierte Unterlagen vor: Grundbuchauszüge, Verträge, Energieausweise, Mieterlisten, oft als Scan mit handschriftlichen Randnotizen. Sie werden von Hand gesichtet, geordnet und auf Lücken geprüft. Das ist zeitaufwendig, und übersehene Abweichungen (veralteter Energieausweis, fehlende Grundbuchseite, geänderter Kaufpreis) fallen erst im Termin auf.

## Zielgruppe

Notariate in Deutschland, die Immobilienkaufverträge vorbereiten. Rollen im Produkt: Notar, Notarassessor, Anwaltsnotar (RA), Sachbearbeiter und Admin einer Kanzlei. Jede Kanzlei ist ein eigener Mandant und sieht ausschließlich ihre eigenen Vorgänge.

## Nutzen

- Die Unterlagen eines Vorgangs werden geprüft, geordnet und auf Lücken untersucht.
- Jede Angabe ist mit Datei, Seite und Originalzitat belegt; der Notar muss der Maschine nichts glauben.
- Der Notar entscheidet: Übersteuern ist möglich, braucht einen dokumentierten Grund und wird revisionssicher protokolliert.
- Fehlende Unterlagen lassen sich per vorformulierter Nachforderung anfordern.

## Kernfunktionen

Dashboard der Vorgänge, zehn Pflichtfelder im Ampelsystem, Prüfplan vor dem Lauf, Nachreichen von Unterlagen ohne Verlust belegter Felder, Übersteuern mit Begründung, Export als Prüfbericht und JSON. Der Funktionsumfang im Detail steht in der [README.md](../README.md).

## Nicht-Ziele

- **Keine Rechtsberatung und keine Entscheidung.** Das Produkt belegt und weist hin; die Verantwortung bleibt beim Notar.
- **Kein Urkundenentwurf.** Das Erzeugen von Word-Urkunden ist bewusst nachgelagert ([BACKLOG.md](BACKLOG.md)).
- **Keine Rechtsgebiete außer Immobilienkaufverträgen**, bis ein weiteres belegt gebraucht wird.
- **Keine Ablösung der Kanzleisoftware.** Das Ergebnis wird exportiert (z. B. für TriNotar, NoRA), nicht dort ersetzt.

## Randbedingungen

- Berufsgeheimnis (§ 203 StGB): strikte Mandantentrennung, serverseitige Identität, Löschfristen als Daten.
- Nachvollziehbarkeit (§ 17 BeurkG): Übersteuerungen und Exporte stehen in einem Append-only-Protokoll mit Hash-Kette.
- Rechtsregeln, Fristen und Kriterien sind Daten in der Datenbank, nie Konstanten im Code.
- Fachsprache der Oberfläche: kanonische deutsche Notarterminologie aus [src/lib/dossier/constants.ts](../src/lib/dossier/constants.ts).

## Erfolgskriterien

- Belegtreue: Keine Angabe ohne nachprüfbare Fundstelle; das messen die Eval-Läufe ([docs/architecture/evaluation-framework.md](architecture/evaluation-framework.md)).
- Der Standardfall der Testakten ([test-akten/](../test-akten/)) liefert alle zehn Felder als belegt, die Stolperfallen-Akten liefern „Prüfung nötig“.
- Kein Mandant sieht Daten eines anderen (RLS-Tests gegen echtes Postgres, `npm run test:db`).
