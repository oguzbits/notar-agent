# Eval-Gate und Härtung der Agenten-Leitplanken Implementation Plan

> **Für Ausführende:** Pflicht-Skill `superpowers:executing-plans` (inline) oder `superpowers:subagent-driven-development`. Tests und Code schreibt der Ausführende selbst (TDD); dieser Plan enthält nur Verträge, Regeln, Testfälle und die Zuordnung Schutz zu rotem Test.

**Ziel:** (1) Die Retrieval-Messung wird als reproduzierbares Eval-Gate mit Baseline ins Repo übernommen, (2) die Agenten-Leitplanken werden vollständig getestet und konsistent, (3) Mutationstests prüfen die Aussagekraft der Tests an den Kernmodulen, (4) die Doku bleibt in Parität.

**Herkunft:** Messbefund Volltext gegen Vektor ([BACKLOG.md §19](../../../BACKLOG.md)); Vorbild ist das Eval-Gate und die Hook-Struktur im Nachbarprojekt notebooklm-klon (Konzept, kein Code kopiert).

## Pre-Flight (AGENTS.md 4A)

- **Scope:** Eval-Gate Retrieval (Fixtures, Gate, DB-Test, Baseline), Stop-Hook und Hook-Konfiguration testbar machen, Stryker-Pilot, Prüfung generierter Doku, Docs-Parität.
- **Referenzbasis:** notebooklm-klon (Eval-Gate mit `baseline.json` und Toleranz, Stryker mit `break`-Schwelle, getestete Hooks), GitHub Actions Required Checks (Gate bricht bei Verschlechterung), Linear-Prinzip "Ratsche": Schwellen werden nur angehoben.
- **Architektur:** Verträge nach `src/types/`, reine Logik nach `src/lib/knowledge/`, Skripte unter `scripts/`. Keine Fachregeln im Code, Fälle sind Testdaten.
- **Nicht enthalten:** Vektorpfad, Migration, Umbenennung von `bm25_score`/`BM25_EXACT` (braucht DB-Sync), Änderungen an `.github/workflows/` und `.husky/` (Schutzdateien, brauchen Bestätigung), Gemini-Aufrufe im Gate (nur im optionalen Vergleichsskript, dort ausschließlich synthetische Daten).
- **Impact:** `LOCAL_CODE_ONLY`. Migration: `NOT_REQUIRED`.
- **Erfolg:** `npm run check`, `npm test`, `npm run test:db` (lokale Supabase), `npm run mutation` für den Pilot.

## Entscheidungsregeln für autonomes Arbeiten

- Nachfragen nur bei: Migration oder Live-DB nötig, Änderung an Schutzdateien (`.husky/`, `.github/workflows/`, `AGENTS.md`, `.claude/settings.json`), Kosten oder Secrets, echter Widerspruch. Sonst entscheiden und im Commit-Text begründen.
- Commit je abgeschlossener grüner Aufgabe auf `main`, normaler Push ist Routine. Nie `--no-verify`, kein Force-Push, kein neuer Branch.
- Keine erfundenen Messwerte: Kann die Baseline nicht gemessen werden (lokale Supabase startet nicht), bleibt Aufgabe 2 als offener Punkt im Bericht stehen, das Gate wird ohne Baseline-Datei nicht aktiviert.
- Vor Container- und Build-Läufen `df -h`; bei unter 10 GB frei melden.
- Neue Pakete (Stryker): Version gegen aktuelle Doku und Kompatibilität mit der installierten Vitest-Version prüfen (Invariante 10), nicht aus dem Gedächtnis wählen.

## Reihenfolge und Modelle

| #   | Aufgabe                          | Modell                       | Review                                      |
| --- | -------------------------------- | ---------------------------- | ------------------------------------------- |
| 1   | Hook-Konfiguration und Stop-Hook | mittel                       | eigenes Review (Sicherheit der Leitplanken) |
| 2   | Eval-Gate Retrieval              | mittel, Gate-Logik stärkstes | Gesamtprüfung                               |
| 3   | Vergleichsskript Volltext/Vektor | klein bis mittel             | keins                                       |
| 4   | Stryker-Pilot                    | mittel                       | Gesamtprüfung                               |
| 5   | Generierte Doku prüfen           | mittel                       | keins                                       |
| 6   | Docs-Parität und Abschluss       | klein                        | Gesamtprüfung des Zweigs (stärkstes Modell) |

## Aufgabe 1: Hook-Konfiguration und Stop-Hook

**Befund (nach Lesen korrigiert):** Die Pfade in `.agents/hooks.json` gelten relativ zu `.agents/` und sind korrekt. Der eigentliche Fehler: `.agents/scripts/guard-*.js` waren eigenständige Duplikate mit abweichender Regel (sie verboten jeden Commit und Push, entgegen `AGENTS.md`), das Stop-Gate prüfte nur `tsc`. `hook-stop.mjs` hatte keinen Test, Dateiauswahl und Schritte waren mit I/O vermischt. Umgesetzt: die Skripte sind dünne Protokoll-Adapter auf `guards.mjs`.

**Verträge** (in [guards.mjs](../../../scripts/agent/guards.mjs), rein, ohne I/O):

- `selectChangedSources(porcelain: string): string[]` liefert geänderte Dateien unter `src/` mit Endung `.ts`/`.tsx` aus der Ausgabe von `git status --porcelain`.
- `buildStopSteps(files: string[]): Array<[string, string[]]>` liefert die Prüfschritte (`tsc`, `eslint` mit den Dateien, `vitest related`); leere Liste, wenn `files` leer ist.

**Regeln:**

- `hook-stop.mjs` nutzt nur diese Funktionen plus I/O; Verhalten bleibt gleich (Exit 2 bei Fehler, `stop_hook_active` beendet ohne Prüfung).
- Jeder `command`-Pfad in `.agents/hooks.json` muss auf eine existierende Datei zeigen. Sind die `.agents/scripts/guard-*.js` Duplikate der Logik in `guards.mjs`, delegieren sie an `guards.mjs` (eine Wahrheitsquelle); sind sie veraltet, werden Konfiguration und Skripte entfernt. Entscheidung nach Lesen der drei Dateien, im Commit begründet.

**Testfälle:**

1. `selectChangedSources` nimmt `src/a.ts` und `src/b/c.tsx` auf, ignoriert `README.md`, `scripts/x.mjs`, `src/a.test.json`.
2. Umbenennungen (`R  alt -> neu`) und Dateien mit Leerzeichen im Pfad werden korrekt behandelt.
3. `buildStopSteps([])` ist leer; mit Dateien enthält `eslint` genau diese Dateien.
4. Jeder `command`-Pfad aus `.agents/hooks.json` existiert (liest die JSON-Datei, kein Mock).
5. Bestehende Fälle für `evaluateCommand` und `evaluateFileWrite` bleiben grün; ergänzt wird `git commit -n` und `git push --force-with-lease`, falls nicht vorhanden.

**Schutz gegen roten Test:** Filter auf `src/` entfernen macht Fall 1 rot; falscher Pfad in `.agents/hooks.json` macht Fall 4 rot (ist vor der Korrektur rot); Entfernen der `--no-verify`-Regel macht Fall 5 rot.

## Aufgabe 2: Eval-Gate Retrieval

**Verträge** (`src/types/eval.ts`, Zod, keine Logik):

- `RetrievalEvalCaseSchema`: `id`, `kind` (`KENNUNG` | `OHNE_KENNUNG` | `OHNE_TREFFER`, als `as const`), `caseType`, `notes`, `fileNames: string[]`, `relevantLegalBases: string[]` (leer nur bei `OHNE_TREFFER`).
- `RetrievalEvalSummarySchema`: `cases`, `promptCoverage` (Anteil relevanter Normen in Schlagwortauswahl ∪ Top 3), `fullCoverageRate`, `coverageWithoutIdentifier` (nur `OHNE_KENNUNG`).
- `RetrievalEvalBaselineSchema`: Summary plus `date`.

**Reine Logik** (`src/lib/knowledge/eval-gate.ts`):

- `buildKnowledgeSearchText(caseType: string, notes: string, fileNames: string[]): string` ist die heutige Suchtextbildung aus `pipeline.ts` (Vorgangstyp, Notizen, Dateinamen, durch Leerzeichen verbunden, leere Teile entfallen). `pipeline.ts` ruft sie auf. Nur diese eine Funktion wird extrahiert, damit Messung und Produktion nicht auseinanderlaufen.
- `summarizeRetrievalEval(results: RetrievalEvalResult[]): RetrievalEvalSummary`.
- `compareToBaseline(summary, baseline, tolerance = GATE_TOLERANCE): string[]` liefert die Maße, die mehr als die Toleranz unter der Baseline liegen, in Worten; leer heißt nicht schlechter. `GATE_TOLERANCE = 0.05`, Kommentar nennt den Grund (ein Fall von rund 40).

**Fälle:** `src/lib/knowledge/fixtures/retrieval-eval-cases.ts` enthält die 48 Fälle der Runde 4 (synthetisch, im Kommentar so gekennzeichnet, mit Hinweis auf den Messbefund). Die Grundwahrheit wird über `legalBasis` des Benchmark-Korpus aufgelöst; jede Angabe muss genau ein Dokument treffen.

**DB-Test** (`src/test/db/retrieval-eval.db.test.ts`): legt das Benchmark-Korpus an (wie `retrieval-quality.db.test.ts`), führt je Fall Schlagwortauswahl (`selectApplicableKnowledge`) und `repo.search({ topK: 3 })` mit `buildKnowledgeSearchText` aus, fasst zusammen und vergleicht mit `src/lib/knowledge/fixtures/retrieval-eval-baseline.json`. Die Baseline wird mit `UPDATE_EVAL_BASELINE=1` neu geschrieben, nie automatisch.

**Testfälle:**

1. `buildKnowledgeSearchText`: Reihenfolge, leere Notizen, Dateinamen verbunden; `pipeline.ts` nutzt sie (Test auf die Pipeline mit gemocktem Repository prüft den übergebenen `queryText`).
2. `summarizeRetrievalEval`: Teilabdeckung eines Falls mit zwei Normen zählt 0,5; `OHNE_TREFFER` zählt nicht in die Abdeckung; leere Eingabe wirft.
3. `compareToBaseline`: genau auf der Toleranz kein Befund, knapp darunter ein Befund; Verbesserung kein Befund; Schema-Fehler der Baseline wirft.
4. Fixtures: jede `relevantLegalBases`-Angabe löst auf genau ein Dokument auf; keine doppelten Fall-IDs; `OHNE_TREFFER` hat keine Normen.
5. DB-Test: Gate gegen Baseline grün; Baseline-Datei fehlt führt zu Fehler mit Hinweis auf `UPDATE_EVAL_BASELINE`.

**Schutz gegen roten Test:** Toleranz auf 1,0 oder Vergleich weglassen macht Fall 3 rot; `pipeline.ts` bildet den Suchtext selbst macht Fall 1 rot; mehrdeutige Rechtsgrundlage macht Fall 4 rot; Verschlechtern der Suche (zum Beispiel UND statt ODER-Verknüpfung testweise) lässt den DB-Test rot werden (einmal manuell prüfen, Ergebnis im Bericht).

**Baseline:** Wert aus einem Lauf gegen die lokale Supabase (`supabase start`, `npm run test:db`). Das Ergebnis wird ehrlich eingetragen, auch wenn es unter den Werten der Scratchpad-Messung liegt (dort Volltext 0,96). Im Bericht wird der Unterschied zwischen Scratchpad (lokale Postgres-Kopie) und RPC-Lauf genannt.

## Aufgabe 3: Vergleichsskript Volltext/Vektor

`scripts/eval/compare-retrieval-variants.ts`: die Runde-4-Messung als nachvollziehbares Skript auf denselben Fixtures aus Aufgabe 2 (Varianten Volltext, Vektor, RPC-Hybrid, Gate, Score-Fusion; Kriterien K1 bis K4 im Kopf). Braucht `GEMINI_API_KEY` und `EMBEDDING_MODEL_ID` aus der Umgebung des Nutzers, wird nie vom Agenten ausgeführt. Ohne Variablen bricht es mit klarer Meldung ab. Lauf-Anleitung im Skriptkopf (Wegwerf-Postgres-Container, Cache-Datei außerhalb des Repos). Kein eigener Test; Teil von `npm run check` (Typprüfung, Lint) und Knip müssen grün sein.

## Aufgabe 4: Stryker-Pilot

**Module:** Kandidaten nach Suche im Code festlegen: Regelauswahl (`src/lib/knowledge/rules/rule-selector.ts`), Eval-Gate (Aufgabe 2), Guards (`scripts/agent/guards.mjs`) und die reine Audit-Logik, falls vorhanden (Hash-Kette läuft in der Datenbank, dort gilt `audit-chain.db.test.ts`).

**Regeln:**

- Eigene Vitest-Konfiguration für Mutationen (ohne jsdom-fremde Tests), Skript `mutation`; nicht in `npm run check` und nicht im Pre-commit (Laufzeit).
- `break`-Schwelle = gemessener Score minus 5 Punkte, danach nur anheben.
- Überlebende Mutanten in den Sicherheitsmodulen (Guards, Eval-Gate): Test ergänzen. Echte Äquivalente mit Begründung als Kommentar notieren. Übrige Überlebende nur auflisten.
- Zeitbox: bei Laufzeit über 10 Minuten Module verkleinern. Kompatibilitätsproblem mit Vitest-Version: kein Patch bauen, Befund melden und Aufgabe als offen markieren.

**Testfälle:** Ergebnis ist die Kennzahl je Modul im Bericht; neue Tests entstehen nur für überlebende Mutanten.

**Schutz:** Eine bewusst eingebaute Mutation (Regel in `guards.mjs` abschwächen) muss `npm run mutation` rot machen; einmal manuell prüfen, danach zurücknehmen.

## Aufgabe 5: Generierte Doku prüfen

Zeitbox 20 Minuten: Welche Fakten in `docs/` sind aus dem Code ableitbar (API-Routen, Umgebungsvariablen, Tabellen, Enum-Werte)? Umsetzung eines `docs:generate --check` nur bei mindestens drei solchen Blöcken (Rule of Three); sonst ein Eintrag mit Befund in [BACKLOG.md](../../../BACKLOG.md). Kein Aufbau auf Verdacht.

## Aufgabe 6: Docs-Parität und Abschluss

- ROADMAP.md: Aufgaben 1 bis 5 als offene Punkte der aktiven Phase, beim Abschluss nach CHANGELOG.md verschieben (nur Ergebnisse, kein Zwischenstand). BACKLOG.md §19 verweist auf das Gate statt auf Scratchpad-Werte.
- `docs/overview.md` und `docs/architecture/evaluation-framework.md`: Eval-Gate (Fälle, Maße, Baseline, Toleranz, Aktualisierung nur bewusst) beschrieben, keine Aufgabenlisten.
- Prüfungen: `npm run check`, `npm test`, `npm run test:db` (falls lokale Supabase lief, sonst ausdrücklich als nicht geprüft melden).
- Abschlussbericht mit DoD-Receipt (Migration `NOT_REQUIRED`, Visual UI `NOT_APPLICABLE`), Ledger je Aufgabe (Dauer, Subagent-Tokens) und einer Summenzeile.

## Ledger

| Aufgabe | Dauer | Subagent-Tokens | Ergebnis |
| ------- | ----- | --------------- | -------- |
| 1       |       |                 |          |
| 2       |       |                 |          |
| 3       |       |                 |          |
| 4       |       |                 |          |
| 5       |       |                 |          |
| 6       |       |                 |          |
