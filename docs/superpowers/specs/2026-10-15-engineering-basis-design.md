# Engineering-Basis: Gates, Docs-Automatik, Agent-Leitplanken – Spec

Stufe 1 des Programms der [Bestandsaufnahme](2026-10-16-bestandsaufnahme.md). Sie folgt auf Stufe 0 (Mandantentrennung schließen) und steht vor dem Produkt- und Design-Fundament ([Spec](2026-10-15-produkt-design-fundament-design.md)), weil jeder spätere Umbau durch diese Gates abgesichert werden soll. Die RLS-Tests (Welle 1, Punkt 2) werden zusammen mit Stufe 0 geschrieben, nicht danach. Die offenen Entscheidungen unten sind in der Bestandsaufnahme beschlossen.

## Ziel

Fehlerklassen, die in der Git-Historie mehrfach erneut behoben wurden, werden durch automatische Prüfungen verhindert, bevor ein Commit oder eine Änderung des Agenten als fertig gilt. Reifegrad-Referenz für die Mechanik ist das Schwesterprojekt notebooklm-klon (nur Engineering, nicht Design oder Produkt).

## Befund (belegt)

| Wiederholter Fehler in `git log`                                                      | Fehlende Absicherung heute                                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Semgrep-Fund „format string" dreimal erst in der CI (`cc913b5`, `1fad809`, `0e2680c`) | Semgrep ist lokal nicht installiert und läuft nur in der CI                      |
| UI-Flackern und Skeleton-Sprünge viermal (`9950334`, `fce766a`, `bbc210d`, `6a9ee1c`) | Ein E2E-Smoke-Test, keine Layout-Messung; „kein CLS" ist nur Behauptung          |
| Mandantenisolation nachgebessert (`22f5ba8`, `1dd1a74`, `c911507`)                    | CI führt nur `supabase db lint` aus, keine RLS-Tests gegen echte Datenbank       |
| Doku-Parität per Hand (AGENTS Abschnitt 2, Punkt 7, 9, 11)                            | Kein Audit für Links, Skripte, Pfade, Maschinenpfade, Zustand in Spezifikationen |
| Gate-Umgehung und Commit-Zuschnitt hängen am Agenten-Verhalten                        | Keine technischen Leitplanken (`.claude/` fehlt im Repo)                         |

## Umfang (drei Wellen, ein Plan)

### Welle 1: Gates gegen Wiederholungsfehler

1. **Lokales SAST, gleiche Regeln wie CI.** `npm run audit:sast` ruft Semgrep mit der Konfiguration auf, die auch die CI nutzt (eine Quelle für beide). Fehlt Semgrep, schlägt der Aufruf mit Installationshinweis fehl; kein stilles Überspringen. Läuft im Pre-push-Hook.
2. **RLS- und Mandantentests gegen echtes Postgres.** Eigenes Vitest-Projekt `db` (`*.db.test.ts`, nicht parallel) gegen lokale Supabase; `npm run test:db`. Je mandantengebundener Tabelle, Storage-Policy und RPC: Nutzer der Organisation B kann Daten der Organisation A weder lesen noch schreiben noch löschen. Neuer CI-Job neben dem bestehenden Migrationscheck.
3. **Layout-Stabilität messbar.** Playwright-Test misst Cumulative Layout Shift beim Laden der Kernansichten (Postfach, Upload, Fortschritt, Cockpit), jeweils Skeleton → Inhalt, mit festem Grenzwert. Läuft im E2E-Job der CI.
4. **ESLint-Strukturgrenzen.** Komplexität, Funktionslänge, Dateilänge, Verschachtelungstiefe, Parameterzahl und verschachtelte Ternaries. Neuer Code strikt; bestehende Verstöße werden über die Bulk-Suppression von ESLint eingefroren und nur verkleinert, nie erweitert (Ratsche).
5. **Modell-IDs per Regel verboten.** ESLint verbietet Modellnamen außerhalb der Konfigurationsschicht (setzt AGENTS Abschnitt 2, Punkt 10 maschinell durch).
6. **CI-Härtung.** Actions auf Commit-SHA gepinnt, `permissions: contents: read`, `concurrency` mit Abbruch älterer Läufe, `npm audit --omit=dev --audit-level=high`. Getrennte Jobs bleiben.

### Welle 2: Docs-Automatik

1. **`npm run audit:docs`.** Prüft defekte Links und Anker, nicht existierende `npm run`-Skripte, nicht existierende Pfade, absolute Maschinenpfade (Invariante 7), Checkboxen und Zustandswörter in Spezifikationen und `AGENTS.md` (Invariante 11). Teil von `npm run check`.
2. **Docs-Map.** `docs/docs-map.json` bindet Codepfade an Dokumente. Ein Commit, der einen gebundenen Pfad ändert, muss das Dokument mitändern oder in der Nachricht `Docs: n/a, <Grund>` tragen. Prüfung im `commit-msg`-Hook und in der CI über die Commit-Spanne.
3. **`npm run docs:generate -- --check`.** Tabellen, die sich aus Code ableiten (Umgebungsvariablen, Enums, Rollen), werden erzeugt; die Prüfung scheitert bei Abweichung.

### Welle 3: Leitplanken für Agenten

1. **`.claude/settings.json`.** `deny` für Lesen und Ändern von `.env*` (Vorlagen wie `.env.example` ausgenommen) und `package-lock.json`; `ask` für `AGENTS.md` und `.claude/**`.
2. **Stop-Hook.** Sind Code-Dateien geändert, muss `npm run check` bestehen, sonst blockiert der Stop einmal. Ein Bestanden-Ergebnis wird per Hash der geänderten Dateien gemerkt; keine Endlosschleife.
3. **Bash-Guard (PreToolUse).** Blockiert `--no-verify`, Force-Push und Zugriff auf Secrets. Als Best-Effort dokumentiert, nicht als Sicherheitsgrenze.
4. **Commit-Regeln in `AGENTS.md`.** Ein Commit pro abgeschlossener, grüner Einheit; Dokumente bleiben bis zur Abnahme uncommittet.

## Interfaces

- Skripte: `audit:sast`, `test:db`, `audit:docs`, `docs:generate`, `audit:docs-map` in `package.json`.
- Dateien: `scripts/audit/audit-docs.mjs`, `scripts/audit/audit-docs-map.mjs`, `scripts/docs/generate.mjs`, `docs/docs-map.json`, `.husky/commit-msg`, `.claude/settings.json`, `.claude/hooks/guard-stop.mjs`, `.claude/hooks/guard-bash.mjs`, `e2e/layout-stability.spec.ts`, `src/**/*.db.test.ts`.
- Jede Prüfroutine ist eine reine Funktion (Eingabe: Dateiinhalt oder Befehlstext; Ausgabe: Liste von Verstößen) mit dünnem Skript-Rahmen, damit sie unit-testbar ist.

## Testfälle und Schutzprüfung

Jeder Test muss durch Entfernen des Schutzes rot werden.

| Schutz                          | Testfälle                                                                                                             | Wird rot, wenn                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| RLS je Tabelle                  | Fremde Organisation: SELECT leer, INSERT/UPDATE/DELETE abgelehnt; eigene Organisation: erlaubt                        | eine Policy entfernt oder aufgeweicht wird  |
| Storage-Policy                  | Fremder Nutzer kann Datei einer anderen Organisation nicht laden                                                      | `is_dossier_job_file` o. Ä. entfernt wird   |
| CLS-Grenzwert                   | Kernansichten bleiben unter Grenzwert; absichtlich entfernter Skeleton überschreitet ihn                              | Skeleton oder reservierter Platz fehlt      |
| Docs-Audit                      | Defekter Link, unbekanntes Skript, unbekannter Pfad, absoluter Maschinenpfad, Checkbox in Spec → je ein Verstoß       | die jeweilige Regel entfernt wird           |
| Docs-Map                        | Geänderter Pfad ohne Dokument und ohne `Docs: n/a` → Verstoß; mit einem von beiden → ok                               | die Bindungsprüfung entfernt wird           |
| Docs-Generate `--check`         | Tabelle weicht vom Code ab → Exit-Code ungleich 0                                                                     | der Vergleich entfernt wird                 |
| Stop-Hook                       | Rot → Block; Grün → Durchlass; zweiter Aufruf mit gleichem Hash → ohne erneuten Lauf; `stop_hook_active` → kein Block | der Block oder die Schleifensperre entfällt |
| Bash-Guard                      | `git commit --no-verify`, `git push --force`, `cat .env.local` → Block; `cat .env.example` → ok                       | die Muster entfernt werden                  |
| ESLint-Grenzen, Modell-ID-Regel | Fixture mit Verstoß schlägt fehl                                                                                      | die Regel deaktiviert wird                  |

## Entscheidungen

Die zunächst offenen Fragen (Semgrep lokal, Grenzwerte, Stop-Hook, Branch-Protection, CLS-Test) sind in der [Bestandsaufnahme](2026-10-16-bestandsaufnahme.md) entschieden.

## Nicht enthalten

Folgearbeiten stehen in [BACKLOG.md §21](../../../BACKLOG.md).

## Wirkung und Nachweis

- Impact: `LOCAL_CODE_ONLY` plus CI-Konfiguration; keine Migration, keine Live-Datenbank-Änderung.
- Erfolgskriterium: `npm run check`, `npm test`, `npm run test:db` und der E2E-Layouttest grün; jede Schutzprüfung aus der Tabelle nachweislich rot bei entferntem Schutz.
