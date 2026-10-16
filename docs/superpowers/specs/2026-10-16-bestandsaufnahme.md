# Bestandsaufnahme und Premium-Programm (Stand 2026-10-16)

Ergebnis einer lesenden Prüfung des gesamten Repos in sieben Dimensionen. Sie ersetzt die Scope-Annahmen der Entwürfe [Engineering-Basis](2026-10-15-engineering-basis-design.md) und [Produkt- und Design-Fundament](2026-10-15-produkt-design-fundament-design.md); beide werden aus diesem Dokument neu zugeschnitten. Referenz für Design und Produktmuster: [Legal-AI-Referenzstudie](2026-10-15-legal-ai-referenzstudie.md).

## Methode und Grenzen

- Sieben unabhängige Prüfungen (Sicherheit, Compliance, Code, Tests und CI, KI und Evals, Doku und Agentic Engineering, UI/UX). Jeder Befund trägt Beleg, Standard, Maßnahme und Aufwand.
- Maßstäbe: OWASP ASVS 5.0.0, OWASP Top 10 für LLM-Anwendungen 2025, OWASP API Security Top 10 2023, NIST SSDF SP 800-218 v1.1, WCAG 2.2 AA, EU AI Act (Rechtsstand noch nicht formal verabschiedet). Eine neuere OpenSSF-Kriterienversion und die aktuelle EN 301 549 konnten nicht belegt werden.
- Nicht geprüft: Live-Datenbank (Policies, Grants, Auth-Einstellungen), Vercel-Konfiguration, Verträge mit Anbietern, dynamische Angriffstests, Seitenlayout per Browser (kein axe, keine Screenshots).
- Von den Hauptbefunden sind zwölf am Code unabhängig nachgeprüft: SEC-01, SEC-02, SEC-03 (Wissens-RPC), unauthentifizierter Analyse-Aufruf, Organisations-ID aus Header, Audit-Schema-Abweichung, Verifikation nur für Textdateien, fehlendes `SKIP LOCKED`, Testdaten in der UI, erzwungener Light-Mode, Mock im Produktionspfad, Absolutpfad in einer Spec.
- Rechtliche Wertungen sind nicht Teil dieser Bewertung und gehören zu Fachjuristen (Liste unten).

## Reifegrad (0 bis 5)

| Dimension                    | Reifegrad | Kernaussage                                                   |
| ---------------------------- | --------- | ------------------------------------------------------------- |
| Architektur und Typen        | 4         | Schichten sauber, depcruise grün, kein `any`                  |
| Code und Zuverlässigkeit     | 3         | Jobs nicht atomar, Domänenwissen im Code                      |
| Doku und Agentic Engineering | 2,5       | Drift, Guards greifen in Claude Code nicht                    |
| UI/UX und Barrierefreiheit   | 2,5       | Tastaturzugang zum Upload fehlt, Kontraste, kein Dark Mode    |
| Tests und CI                 | 2         | Keine DB- oder RLS-Tests, ein E2E-Test                        |
| KI und Evals                 | 2         | Gute Architektur, Evals tautologisch, Verifikation lückenhaft |
| Compliance                   | 1,5 bis 2 | Verträge, Löschkonzept, Audit-Beweiswert offen                |
| Sicherheit                   | 1 bis 2   | Mandantentrennung bricht in der Datenbank selbst              |

Gesamturteil der Prüfung: gute Architektur, aber ein Prototyp. Für Echtakten von Berufsgeheimnisträgern nicht freigabefähig. Der Health-Score 90/100 misst Hygiene und keine Sicherheit: kein Authz, keine Race Conditions, keine Coverage, keine CVEs, keine RLS-Wirkung.

## Befundregister

### P0: Mandantentrennung und Zugriff

| ID           | Befund                                                                                                                                                                          | Beleg                                                                                         | Maßnahme                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SEC-01       | Jeder angemeldete oder anonyme Nutzer kann sich mit beliebiger Rolle in eine fremde Kanzlei eintragen; die Bedingung `NOT EXISTS` vergleicht eine Spalte mit sich selbst        | `supabase/migrations/20260915000000_core_multi_tenancy.sql` Policy `rls_org_members_insert`   | Policy neu: Einfügen nur durch NOTAR oder ADMIN der Zielkanzlei, Erstmitgliedschaft nur über kontrollierten Onboarding-Pfad |
| SEC-02       | Anonymer Lesezugriff auf Dateien aller Kanzleien über `OR is_dossier_job_file(name)` (SECURITY DEFINER, durchsucht alle Jobs, Policy gilt für `public`)                         | `supabase/migrations/20260921000000_jobs_and_workflows.sql` Policy `RLS dossier_files select` | Worker-Zugriff nur über eigenen, eingeschränkten Pfad; Funktion mit `search_path`, Mandantenbezug und ohne `public`-Zugriff |
| SEC-03, F12  | `match_knowledge_documents`: SECURITY DEFINER, Organisation als freier Parameter, ohne `search_path`; Kanzleiwissen jeder Kanzlei lesbar                                        | `supabase/migrations/20260916000000_knowledge_and_vector.sql`                                 | Organisation aus `auth.uid()` ableiten, `search_path` setzen, REVOKE                                                        |
| SEC-04, F2   | `POST /api/analyze` ohne Anmeldung aufrufbar; die Middleware lässt alle `/api`-Routen durch; kein Rate-Limit, kein Token-Limit                                                  | `src/app/api/analyze/route.ts`, `src/lib/supabase/middleware.ts`                              | Gemeinsamer Auth-Helfer je Route, Pflichtanmeldung, Limits                                                                  |
| SEC-05, C-05 | `PUT /api/analyze` und Audit-Route: kein Sitzungsbezug, `actor` und `actorRole` aus dem Request-Body                                                                            | `src/app/api/analyze/route.ts`, `src/app/api/documents/[id]/audit/route.ts`                   | Akteur, Rolle, Organisation nur aus Sitzung und Mitgliedschaft                                                              |
| SEC-17, F1   | Organisations-ID aus Header oder Query wird vor der Sitzungsprüfung akzeptiert; RLS ist der einzige Schutz (AGENTS Abschnitt 2, Punkt 1 verletzt)                               | `src/lib/supabase/server-auth.ts`                                                             | Override entfernen, Organisation nur aus Mitgliedschaft                                                                     |
| C-01, SEC-06 | Audit-Code schreibt `actor`, `details`, `current_hash`, `timestamp`; die Migration hat `actor_id`, `payload`, `hash`, `created_at`: entweder Live-Drift oder Audit schlägt fehl | `src/lib/audit/audit-repository.ts`, `core_multi_tenancy.sql`                                 | Live-Schema prüfen, in der Migration konsolidieren, DB-Test                                                                 |
| SEC-08       | Demo: festes Passwort und gemeinsames NOTAR-Konto in der Produktionsmigration; anonyme Nutzer erhalten die Rolle NOTAR; keine Bereinigung, kein Captcha                         | `src/types/auth.ts`, `core_multi_tenancy.sql`                                                 | Seed raus, Demo nur in separater Umgebung, Bereinigungsjob                                                                  |
| F01          | Zitate und Zahlen werden nur bei Nicht-Base64-Dateien geprüft; bei Scans (Hauptfall) bleibt ein Feld unverändert VERIFIED                                                       | `src/lib/ai/pipeline.ts`, `src/lib/ai/verifiable-fact-checker.ts`                             | Prüfung auf serverseitigem Text beider Wege, fail-closed (NEEDS_REVIEW)                                                     |

Hinweis: Ein anonymer Anon-JWT eines gehosteten Projekts liegt laut Sicherheitsprüfung in der Git-Historie (Commit `affac31`). Der Anon-Key gilt zwar als öffentlich, macht SEC-01 und SEC-02 aber direkt ausnutzbar. Rotation und Prüfung der Live-Logs auf Fremdbeitritte und anonyme Dateizugriffe sind Maßnahmen des Betreibers.

### P1: Verlässlichkeit, Nachweisbarkeit, Compliance

| Bereich        | Befunde                                                                                                                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jobs           | Kein atomarer Claim, `SKIP LOCKED` in Doku behauptet, im Code nicht vorhanden (Doppelausführung); Zombie-Jobs ohne Heartbeat; späte Fortschrittsschreibvorgänge überschreiben COMPLETED; Daemon plant sich mehrfach (F4 bis F7)                                                                                              |
| Audit-Trail    | Hash-Kette mit Lese-dann-Einfügen und ohne UNIQUE (Fork), Append-only nicht per Trigger, Kette ohne externen Anker, Abschneiden nicht erkennbar; keine Events für Export, Rollenänderung, Löschung, Lesen (C-02 bis C-04, SEC-06)                                                                                            |
| KI-Pipeline    | Parse- und Schemafehler laufen ungeprüft weiter (nicht fail-closed); Auditor kann Status hochstufen ohne erneute Prüfung; Zitatprüfung nur über 30 Zeichen, Zahlen irgendwo im Dokument, Seite nie geprüft (F05, F06, F14)                                                                                                   |
| Evals          | Offline-Eval aus Ground Truth gebaut (100 Prozent ohne Aussage); 10 Fälle, kein n≥3, keine Fehlerraten je Feld, kein KI-Gate in der CI; Retrieval-Benchmark misst nicht die Produktionssuche (F02, F03, F07 bis F10, F18)                                                                                                    |
| Wissensschicht | Gesetzesverweise, Zahlen (25.000 €, „10 Jahre GEG") als Code und im Prompt (Invariante 5 verletzt); `knowledge_documents` ohne Version, Gültigkeit, Quelle, Review (F11, F12, F9)                                                                                                                                            |
| Sicherheit     | Rollenmodell nur im Client, RLS rollenblind (ADMIN sieht alle Akten); `next` 16.3.4 mit bekannten Lücken; keine Security-Header oder CSP; Open Redirects; PDF- und ZIP-Bomben; Prompt-Injection über Notizen und Stufe-1-JSON (SEC-07, SEC-09 und weitere)                                                                   |
| Compliance     | Löschung nur teilweise und nicht auditiert; Retention-Konzept offen; Personenbezug in unveränderlicher Kette; kein Verarbeitungsverzeichnis, keine TOM, kein Subprozessor-Register, kein Prozess zur Verpflichtung von Dienstleistern; KI-Anbieter ohne dokumentierte Region, Zero-Retention, Vertrag (C-06 bis C-10)        |
| Tests und CI   | Kein DB- und RLS-Test, ein E2E-Test mit gemockter API ohne CI-Job, keine Coverage, `jsdom` für alle Tests; Actions ohne SHA-Pin, ohne `permissions` und `concurrency`, kein `npm audit`-Gate, Semgrep nur in der CI (T1 bis T12)                                                                                             |
| Doku, Agenten  | Guards in `.agents/` nur für Antigravity; kein `.claude/`; AGENTS.md verbietet Agenten das Committen, die Praxis (188 Commits) und die Nutzerregel widersprechen; README nennt falschen Demo-Login, PDFium und `unpdf`; tote Pfade; ROADMAP und Specs mit Checkboxen; LICENSE, SECURITY.md, Threat-Model, ADRs fehlen        |
| UI/UX          | Upload-Zone per Tastatur unerreichbar, verschachtelt interaktive Tabellenzeilen, Job-Zeilen nur per Maus; Ladefehler wird als „Keine Vorgänge" angezeigt; Kontraste unter 4,5:1 (Fehlertexte) und 3:1 (Rahmen, Fokus-Token); technische KI-Begriffe und Denglisch in der UI; Testdaten in der Produktions-UI; kein Dark Mode |

### Wiederholungsmuster der Git-Historie

Vier Fehlerklassen sind jeweils mehrfach behoben worden, weil ein automatischer Schutz fehlte: Semgrep erst in der CI (dreimal), UI-Flackern (viermal), Mandanten- und Auth-Isolation (siebenmal), `package-lock`-Abgleich (dreimal).

## Programm in Stufen

Reihenfolge nach Risiko. Jede Stufe endet mit nachweislich grünen Gates und einem Commit je abgeschlossener Einheit.

### Stufe 0: Mandantentrennung schließen (vor jeder weiteren Entwicklung)

- Zuerst Negativtests schreiben (TDD): fremde Kanzlei, `anon` und anonyme Nutzer dürfen weder lesen noch schreiben noch beitreten; jeder Test muss durch Entfernen der Korrektur rot werden. Mechanik: Vitest-Projekt `db` gegen lokale Supabase.
- Korrekturen konsolidiert in den kanonischen Migrationen (Invariante 8): SEC-01, SEC-02, SEC-03, Audit-Spalten, `search_path` und REVOKE für alle SECURITY-DEFINER-Funktionen.
- Anwendungsschicht: Auth-Helfer je Route, Override und anonyme Repository-Fabriken entfernen, Akteur und Rolle nur aus der Sitzung, Limits vor KI-Aufrufen, Demo-Seed und festes Passwort entfernen.
- Live-Abgleich und Anon-Key-Rotation sind externe Maßnahmen und nur mit ausdrücklicher Zustimmung des Betreibers.

### Stufe 1: Gates (Engineering-Basis)

RLS- und Mandantentests in der CI, Semgrep lokal mit gleichen Regeln wie CI, Layout- und axe-Test im E2E gegen den Produktionsbuild, Coverage mit Schwellen, ESLint-Strukturgrenzen mit Ratsche und `jsx-a11y`, Modell-ID-Verbot per Regel, CI-Härtung, Docs-Audit mit Docs-Map und Commit-Hook, Portierung der Agenten-Guards nach `.claude/` (Stop-Hook, Bash-Guard, Deny-Regeln), Commit-Regeln in AGENTS.md. Die Entscheidungen zu den offenen Punkten stehen unten.

### Stufe 2: Korrektheit von Pipeline, Jobs und Evals

Fail-closed-Verifikation für Text und Scans, Auditor ohne ungeprüfte Hochstufung, atomarer Job-Claim in der Datenbank mit Heartbeat und Retry-Grenze, Idempotenz, ehrliche Live-Evals (n≥3, Zitat-Treue, Fehlerraten je Feld) mit CI-Gate und Quota-Stop, Retrieval-Messung gegen die Produktionssuche, Governance der Wissensschicht (Version, Gültigkeit, Quelle, Review).

### Stufe 3: Nachweisbarkeit, Compliance, Betrieb

Audit-Append in der Datenbank mit Sperre, Anker und vollständigen Ereignissen; serverseitiges RBAC; Löschpipeline mit Nachweis; Subprozessor-Register, Produktions-Gate für Region und Vertragsflag; Verarbeitungsverzeichnis und TOM; KI-Kennzeichnung und menschliche Letztentscheidung; Observability (Request-ID, typisierte Logs, Fehlerberichte mit Allowlist, Uptime); Token- und Kostenerfassung mit Limits; LICENSE, SECURITY.md, Threat-Model, ADRs, Runbook.

### Stufe 4: Produkt und Design

Tastatur- und Screenreader-Blocker, Kontraste, Fehlerzustände, Terminologie, Produkt- und Design-Fundament (PRODUCT.md, DESIGN.md, Harvey-nahe Token), Beleg-Cockpit mit Fundstelle und Konfidenz, Prüfplan vor dem Lauf, Review-Tabelle mit Zellstatus, Strg+K, Vertrauensleiste. Die A11y-Blocker der Tastatur (Upload, Zeilen) ziehen in Stufe 1 vor.

## Entscheidungen zu den offenen Punkten der Engineering-Basis

- **Semgrep lokal:** feste Version über Python-Paket (`pipx`), als `npm run audit:sast` mit Installationshinweis bei Fehlen; gleiche Konfigurationsdatei wie in der CI. Läuft im Pre-push, nicht im Pre-commit.
- **CLS:** Grenzwert 0,1 (Web-Vitals-Richtwert „gut"), danach per Ratsche verschärfen. Der Layouttest läuft gegen den Produktionsbuild mit API-Fixtures; der Kernflusstest läuft getrennt gegen lokale Supabase.
- **ESLint-Grenzen:** Komplexität 10, Funktionslänge 60, Dateilänge 300, Verschachtelung 3, Parameter 4. Bestehende Verstöße werden per Bulk-Suppression eingefroren.
- **Stop-Hook:** schnelle Teilmenge (Typprüfung, Lint, betroffene Tests); das volle `npm run check` bleibt Pre-push und CI. Laufzeit wird gemessen und muss unter einer Minute bleiben.
- **Pre-commit:** nur `lint-staged`; schwere Prüfungen (knip, depcruise, Audits) wandern in Pre-push und CI.
- **Branch-Protection mit Required Checks:** empfohlen, aber eine Einstellung auf GitHub mit externer Wirkung; nur mit Zustimmung des Betreibers.

## Offen für den Betreiber

1. **AGENTS.md-Widerspruch:** Der Abschnitt „Authoritative Git Execution" und der Command-Guard blockieren Agenten-Commits; die Praxis und die globale Arbeitsregel behandeln Commits als Routine. Vorschlag: Antigravity-spezifische Sätze entfernen. Das ändert eine Regeldatei und braucht Zustimmung.
2. **Live-Abgleich** der Datenbank (Policies, Grants, Audit-Spalten) per Supabase-Zugang und **Rotation des Anon-Keys**.
3. **Prüfung der Live-Protokolle** auf Fremdbeitritte und anonyme Dateizugriffe.

## Fragen an Fachjuristen (nicht Teil dieser Bewertung)

Reichen Verpflichtung durch den Cloud-Anbieter und dessen Unterauftragnehmer, Zero-Retention und EU-Region für § 26a BNotO und § 203 StGB? Notarielle Aufbewahrungsfristen gegenüber Löschpflichten und Zulässigkeit von Personenbezug in einer Hash-Kette. Risikoklasse und Pflichten nach EU AI Act für eine Prüfhilfe. Beweiswert des Audit-Logs (qualifizierter Zeitstempel). Zulässigkeit von Demo- und anonymen Sitzungen neben Echtdaten. Anwendbarkeit des BFSG auf B2B-Notariatssoftware.
