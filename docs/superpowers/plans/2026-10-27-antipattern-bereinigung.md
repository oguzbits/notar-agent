# Antipattern-Bereinigung (Jobs, Sicherheit, stille Fehler) Implementation Plan

> **Für Ausführende:** Pflicht-Skill `superpowers:executing-plans` bzw. `superpowers:subagent-driven-development`. Tests und Code schreibt der Ausführende selbst (TDD). Dieser Plan enthält nur Befunde, Verhaltensregeln, Testfälle und die Zuordnung Schutz zu rotem Test.

**Ziel:** Die Befunde der Antipattern-Suche vom 27.10.2026 beheben, Paket für Paket, jeweils mit Tests, die den Fehlerpfad prüfen.

**Herkunft:** Drei lesende Prüfungen (UI und Hooks, API und Server, Pipeline und Jobs), die schweren Befunde in der Hauptsitzung am Code bestätigt. Auslöser: Der Upload hatte lange keinen Fortschritt und lud bei jedem Hinzufügen alles neu hoch.

**Grundursache:** Tests prüfen fast nur den Erfolgsweg; Mocks bestätigen Verhalten, statt es zu prüfen (Mock-Repository meldet immer Erfolg, Abbruch-Tests übergeben das Signal von Hand). Deshalb gilt für jedes Paket: Zu jeder Schutzfunktion ein Test, der durch Entfernen des Schutzes rot wird.

## Pre-Flight (AGENTS.md 4A)

- **Scope:** Pakete 1 bis 6 unten.
- **Referenzbasis:** Postgres-Zustandsautomat mit bedingtem Update (Compare-and-set, wie `transitionJob`), OWASP (Open Redirect, Fehlertexte), Vercel AI SDK `abortSignal`, GitHub/Linear (Audit-Log für Rollenänderungen).
- **Architektur:** Routen bleiben dünn, Logik in `src/lib/`, Verträge in `src/types/`. Fail-Fast statt Ausweichwerten.
- **Nicht enthalten:** Live-Datenbank-Änderungen (Migrationen werden lokal angewendet und getestet, Live-Sync bleibt offen bis zur Freigabe), Änderungen an Schutzdateien (`.github/workflows/`, `.husky/`, `AGENTS.md`, `scripts/agent/`, `.claude/settings.json`), Deploys.
- **Impact:** `LOCAL_CODE_ONLY`; Pakete 3 und 6 `DECLARATION_STAGED` (Migration).
- **Erfolg:** `npm run check`, `npm test`, `npm run test:db`, bei UI-Änderungen der Smoke-E2E-Test.

## Entscheidungsregeln

- Commit je Paket (oder je abgeschlossener Einheit) auf `main`, normaler Push ist Routine. Nie `--no-verify`, kein neuer Branch, kein Force-Push.
- Nur nachfragen bzw. offen lassen bei: Live-DB, Secrets, Kosten, Schutzdateien.
- Migrationen: in die passende Domain-Migration einarbeiten (Invariante 8), lokal per `supabase db reset` prüfen, Live-Sync als offenen Punkt melden.
- Ein Befund, der sich beim Lesen als falsch herausstellt, wird nicht „behoben", sondern im Ledger mit Begründung vermerkt.

## Paket 1: Job-Zustand (Zustandslogik, eigenes Review)

**Befunde**

- Abbruch wirkt nicht: Signal erreicht `generateText` nicht; Abschluss überschreibt CANCELLED mit COMPLETED (`src/lib/jobs/job-worker.ts` Abschluss/Fehlerpfad, `cancelDossierJob`).
- Staleness über nie erneuertes `lockedAt`: laufende Jobs werden nach 3 Minuten FAILED (`src/app/api/jobs/[id]/route.ts`, `recoverOrphanJobs`); GET schreibt Status.
- `lockedAt: undefined` / `errorMessage: undefined` werden übersprungen (`buildUpdateData`), Sperre und alte Fehler bleiben.
- `retryCount` wird an mehreren Stellen gezählt (Worker, Requeue, Recover).
- Fortschritts-Updates ohne `catch` (unhandled rejection) und ohne Statusbedingung (können COMPLETED/CANCELLED überschreiben).
- Extraktion mit ungültigem Ergebnis gilt als Erfolg (`rawExtractionJson || {}` in `src/lib/ai/pipeline.ts`), wird als Checkpoint gespeichert.
- `recoverOrphanJobs`: `select('*')` mit Payload, N+1-Updates, PENDING-Zweig nutzt `created_at`.

**Regeln**

- Jeder Statuswechsel geht über `transitionJob(id, from, update)`. Erlaubt: PENDING→PROCESSING (Claim), PROCESSING→COMPLETED/FAILED, PENDING|PROCESSING→CANCELLED, FAILED→PENDING (Requeue), PROCESSING|PENDING→FAILED (veraltet). Trifft der Übergang keine Zeile, wird nichts überschrieben.
- Felder löschen: `UpdateJobParams` erlaubt `null` für `lockedAt` und `errorMessage`; `null` wird geschrieben, `undefined` bedeutet „unverändert".
- Lebenszeichen: Veraltet heißt `updated_at` älter als die Frist; jedes Fortschritts-Update erneuert `updated_at`. `lockedAt` wird für Staleness nicht mehr verwendet.
- GET-Routen schreiben keinen Status. Die Heilung veralteter Jobs läuft als ein bedingtes Update (oder RPC) an einer Stelle (bestehender Aufruf in `GET /api/jobs` darf bleiben, aber ohne N+1 und mit Bedingung).
- Das Abbruchsignal wird an alle `generateText`-Aufrufe und an `embedQuery` (falls das SDK es unterstützt) durchgereicht; der Worker prüft es zwischen den Stufen.
- `retryCount` zählt genau einmal pro erneutem Versuch (beim Requeue).
- Fortschritts-Updates: `transitionJob(id, [PROCESSING], …)` mit `.catch` + `logFailure`.
- Ungültige Extraktion (Schema und Reparatur gescheitert) wirft; kein Checkpoint, Job FAILED mit fester deutscher Meldung.

**Testfälle (Schutz → roter Test)**

1. Abbruch während Stufe 2: Worker endet nicht mit COMPLETED; Status bleibt CANCELLED (bedingten Abschluss entfernen → rot).
2. Abbruchsignal erreicht das Modell: Mock-Modell sieht `abortSignal` (Durchreichen entfernen → rot).
3. Job mit altem `lockedAt`, aber frischem `updated_at` gilt nicht als veraltet (zurück auf `lockedAt` → rot).
4. GET auf einen laufenden Job verändert den Status nicht.
5. `lockedAt: null` und `errorMessage: null` werden geschrieben (Repository-Test auf die Update-Daten oder DB-Test).
6. Requeue zählt `retryCount` um genau 1; Fehler im Worker zählt nicht zusätzlich.
7. Fortschritts-Update nach COMPLETED ändert nichts; DB-Fehler im Fortschritt führt nicht zu unhandled rejection.
8. Ungültige Extraktion: Pipeline wirft, kein Checkpoint.
9. DB-Test: bedingte Heilung setzt nur veraltete PROCESSING/PENDING-Jobs auf FAILED, frische nicht.

## Paket 2: Sicherheit und Audit (eigenes Review)

**Befunde**

- Open Redirect: `next`/`redirectTo` ungeprüft in `src/app/auth/callback/route.ts` und im Response von `src/app/api/auth/demo/route.ts`.
- Team: PATCH/DELETE/POST ohne Audit-Eintrag; Selbständerung der eigenen Rolle und Entfernen des letzten NOTAR möglich.
- `PUT /api/analyze`: Statuswechsel am Feld ohne `auditOverride` wird gespeichert, aber nicht auditiert.
- Kontingent (`JOB_RATE_LIMIT`) greift nur bei `async=true`; der SSE-Pfad ist unbegrenzt.

**Regeln**

- Weiterleitungsziel nur als relativer Pfad: beginnt mit `/`, nicht mit `//` oder `/\`; sonst `/`. Reine Funktion in `src/lib/`.
- Rollenänderung, Entfernen und Einladen schreiben ein Audit-Ereignis (Akteur, Ziel, alte/neue Rolle). Eigene Rolle ändern und den letzten NOTAR entfernen/herabstufen wird mit 4xx abgelehnt.
- Erkannter Feld-Statuswechsel ohne `auditOverride` → 400 mit deutscher Meldung (Grund ist Pflicht); mit `auditOverride` wie bisher.
- Kontingent wird vor der Verzweigung async/SSE geprüft.

**Testfälle**

1. `next=@evil.example`, `//evil`, `/\evil`, `https://evil` → `/`; `/vorgang?id=1` bleibt.
2. Team-PATCH schreibt Audit-Ereignis; Selbständerung → 403/409; letzter NOTAR → 409.
3. PUT mit Statuswechsel ohne `auditOverride` → 400, nichts gespeichert.
4. SSE-Pfad über dem Kontingent → 429.

## Paket 3: Still kaputte Funktionen

**Befunde**

- `inviteMember` legt Mitgliedschaft mit Zufalls-`user_id` an (FK auf `auth.users` → schlägt immer fehl).
- `DossierRepository.update` meldet Erfolg ohne getroffene Zeile; `removeMember` immer `true`.
- Teamliste: Profile anderer Mitglieder nicht lesbar (RLS nur eigenes Profil), Platzhalter „Kanzleimitglied"/„mitarbeiter@kanzlei.de".
- `/api/auth/me`: `.single()` bei mehreren Mitgliedschaften → Rolle fällt still auf SACHBEARBEITER.
- Registrierung bei aktiver E-Mail-Bestätigung: keine Sitzung, RPC wirft, Zugang verwaist.

**Regeln**

- Einladung: Solange kein echter Einladungsweg existiert, liefert der Endpunkt eine klare 501-Antwort mit deutscher Meldung, die UI zeigt sie an; kein Insert mit erfundener ID. (Echter Einladungsweg ist Folgeaufgabe im Backlog.)
- `update`/`removeMember` prüfen die Anzahl getroffener Zeilen (`.select('id')`); keine Zeile → `DossierNotFoundError` bzw. `false` (404 in der Route).
- Profile von Kanzleikollegen lesbar per RLS-Policy (Mitgliedschaft in derselben Organisation); keine Platzhalter, Fehler werfen. Migration in der Core-Domain-Migration.
- `/api/auth/me`: Mitgliedschaften als Liste, Auswahl per `x-organization-id` bzw. bestehender `pickOrganization`-Logik, kein Rollen-Ausweichwert.
- Registrierung ohne Sitzung: Erfolg mit Hinweis „E-Mail bestätigen", Kanzlei wird beim ersten Login angelegt (bestehender Onboarding-Weg).

**Testfälle:** je Regel ein Test, der ohne die Prüfung rot wird; DB-Test für die neue Profil-Policy (Kollege lesbar, Fremder nicht).

## Paket 4: UI-Zustände

**Befunde**

- `useJobs`: `retryJob`/`cancelJob`/`deleteJob` schlucken Fehler; Aufrufer zeigen nichts.
- `page.tsx`: erfundener PENDING-Job für unbekannte Job-ID, `useJob` pollt bei `null` endlos; Nicht-gefunden-Ansicht toter Code.
- Lade-Fehler der Übersicht (`loadError`, `jobsError`) ohne Anzeige und ohne Wiederholen.
- `ExportActions`: Bericht wird bei Fehler des Audit-Trails still ohne Audit-Trail erzeugt.
- Löschdialog schließt vor dem Löschen; Zeilenaktionen währenddessen nicht gesperrt.
- `UploadZone`: Fehlermeldung nennt die Datei nicht.

**Regeln:** Fehler werden sichtbar (deutsche Meldung, Wiederholen-Aktion), Polling endet bei 404, Platzhalter-Job nur während des Ladens bzw. direkt nach dem Einreihen, Export bricht bei fehlendem Audit-Trail mit Meldung ab, Aktionen während laufender Mutation gesperrt.

**Testfälle:** je Regel ein Komponententest; Smoke-E2E bleibt grün.

## Paket 5: Last, Aufbewahrung, Fehlertexte

**Befunde**

- `listJobs` lädt `payload` (Base64-Dateien) für jeden Poll, ohne Limit.
- `pruneCompletedJobs` hat keinen Aufrufer; erledigte Jobs mit Mandantendateien bleiben unbegrenzt.
- `deleteJob` ignoriert den Fehler von Storage-`remove()`.
- Rohe DB-/Provider-Fehlertexte in 500-Antworten und in `error_message` der Jobs.
- `recordPruefgrundlage` schluckt Fehler.
- Wiederholung erfasst keinen Tokenverbrauch (`usageRepo` fehlt in `POST /api/jobs`).
- Dokumentliste ohne Begrenzung.

**Regeln:** Liste ohne `payload` (Metadaten über JSON-Pfad oder eigene Spalten), mit Limit; Prune im bestehenden Cron; Storage-Fehler werfen vor dem Löschen der Zeile; 500-Antworten mit fester deutscher Meldung, Details nur ins Log (Muster wie `pruefplan`/`confirm`); Job-Fehlermeldungen für Nutzer fest formuliert; Audit der Prüfgrundlage wirft oder markiert den Job; `usageRepo` auch beim Requeue; Dokumentliste mit Limit.

## Paket 6: Fachregeln aus dem Code

**Befunde:** Schwellen und Fristen in `src/lib/workflow/default-workflows.ts` (GwG 1 Mio. €, 10 Jahre, 25.000 €), `src/lib/knowledge/rules/arithmetic-guardrails.ts` (Toleranzen, Muster, Normbezüge); GwG-Gate-Schritt wird nie ausgewertet; `MOCK_AI` ohne Produktionsschutz; Workflow-Fehler im SSE-Pfad nur geloggt, async-Pfad legt keinen Workflow an.

**Regeln:** Werte als Wissensdokumente bzw. Daten in der Datenbank (Knowledge-Domain-Migration), Code liest sie; unverdrahteter Gate-Schritt wird entfernt oder verdrahtet (kleinere Änderung wählen); `MOCK_AI` in Produktion abgelehnt; Workflow-Fehler werden gemeldet, nicht verschwiegen.

## Ledger

| Paket                             | Dauer                                                                                             | Subagent-Tokens                                         | Commits                                                                                            | Bemerkung                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Job-Zustand                     | 24 min (Umsetzung 12,5, Review 4,6, Nacharbeit)                                                   | 311.215 (205.283 + Review 105.932)                      | 1247308, 17e6878, ed76f38                                                                          | Review fand 4 Befunde (Abbruch beim Speichern, fehlende Lauf-Kennung, Controller-Aufräumen, Erfolgsmeldung trotz verlorenem Wettlauf), alle behoben mit roten Gegenproben. Offen als Hinweis: rohe Fehlertexte in `errorMessage` (Paket 5), wartende Jobs ohne Lebenszeichen werden nach 3 min FAILED (wie vorher)                                                                                        |
| 2 Sicherheit und Audit            | 52 min (Umsetzung 23,4, Review 7, Nacharbeit 19,8)                                                | 496.418 (233.612 + Review 145.928 + Nacharbeit 116.878) | 0154f4b, fed1010, bd61d57, dcebeda, ec04691, 4fc4c0f, 3bf0b0f, 86cdc0d (zurückgenommen in a1afd30) | Review fand 7 Befunde (Trigger per Verschieben umgehbar, Kontingent ohne Live-Läufe, Begründung nicht an Wechsel gebunden u. a.), alle behoben. Live-Kontingent zurückgestellt, weil Push auf main in Produktion deployt und die DB-Funktion live fehlt (B.11.2a)                                                                                                                                         |
| 3 Still kaputte Funktionen        | 16 min (Umsetzung 13,7, Prüfung in der Hauptsitzung)                                              | 153.469                                                 | 0267632, 801d118, 3f78ae1, f66830c, b218fe2 (zurückgenommen in a5c57a5)                            | `removeMember` war schon durch Paket 2 behoben. Kein eigenes Subagent-Review: Auth-Diffs klein, in der Hauptsitzung gelesen. Profil-Policy wartet auf Live-Migration (B.11.2a). Registrierungsdaten der Kanzlei werden bei E-Mail-Bestätigung im Onboarding-Dialog erneut erfragt                                                                                                                         |
| 4 UI-Zustände                     | 13 min (Umsetzung 11,8)                                                                           | 162.432                                                 | d71fb30, 962a123, 79059e2, de61632, 5da8cb6                                                        | Kein eigenes Review (UI, kein Sicherheits-/Zustandskern); Screenshots in der Hauptsitzung geprüft. Zeilenaktionen nicht separat gesperrt (modaler Dialog sperrt bereits). Rest: Brotkrume zeigt bei „nicht gefunden“ „Vorgang in Prüfung“; Upload-Fehler nennt alle Dateien der Auswahl. Health jetzt 90/100 (Minimum)                                                                                    |
| 5 Last, Aufbewahrung, Fehlertexte | 19 min Agentenzeit (Umsetzung 13,2, Review 2,1, Nacharbeit 4,1; Wanduhr länger wegen Limit-Pause) | 306.743 (166.727 + Review 71.340 + Nacharbeit 68.676)   | 87500ce, 5057394, 03734cd, 860874c, 1e68520, ddfc4d0, b1e96ee                                      | Review (Sonnet) fand 0 kritische, 2 wichtige Befunde: Aufräumlauf blieb an einer defekten Datei hängen (behoben, Gegenprobe rot), Doppel-Dossier-Randfall bei Wiederholung (BACKLOG). Login-Fehler jetzt geloggt, `_2`-Log-Tags ersetzt (nur die drei Routen des Pakets; weitere `_2`-Tags in organization/team offen). Aufbewahrung 7 Tage: Quelldateien werden nur während der Analyse gelesen. Gepusht |
