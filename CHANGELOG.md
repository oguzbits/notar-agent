# Notar Agent — Changelog & Meilenstein-Archiv

> **Zweck:** Vollständiges Archiv aller fertiggestellten Architektur-, Core- und Compliance-Meilensteine.  
> **Kontext:** Dient als Revisionsnachweis und historisches Logbuch. Die aktive, zukunftsorientierte Arbeitsplanung befindet sich in [ROADMAP.md](./ROADMAP.md).

---

## 📋 Übersicht der erreichten Meilensteine

| Bereich       | Meilenstein                                | Status            | Kern-Ergebnis                                                                                                        |
| :------------ | :----------------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------- |
| **Phase A**   | A.1 Playwright E2E Basis-Schutz            | [x] Abgeschlossen | Smoke-Test Workflow (`e2e/smoke-workflow.spec.ts`) mit Upload, Stepper, Table & Overrides                            |
| **Phase A**   | A.2 RAG-Auditor (JIT Rule Retrieval)       | [x] Abgeschlossen | Typisierte Regel-Registry & JIT-Selektor für BGB, BeurkG, HGB, GBO, GEG, BauGB in Stufe 2                            |
| **Phase A**   | A.4.1 Baseline-Scorer & Golden Dataset     | [x] Abgeschlossen | 8 synthetische Referenzakten, P50–P99 Latenz- und Provenance-Scorer (`scripts/eval-pipeline.ts`)                     |
| **Phase A**   | A.4.2 Promptfoo Integration                | [x] Abgeschlossen | Multi-Modell Evaluation Matrix & Web-Dashboard (`config/promptfoo.yaml`, `npx promptfoo view`)                       |
| **Phase B**   | B.1 PostgreSQL Job-Queue                   | [x] Abgeschlossen | Entkoppelte Queue `dossier_jobs` (`PENDING/PROCESSING/COMPLETED/FAILED`), `202 Accepted` < 250ms                     |
| **Phase B**   | B.2 Dual-Stream Ingestion Pipeline         | [x] Abgeschlossen | Byte-Introspektion (`unpdf` Unicode-Textlayer + Vision-Fusion für Siegel & Handschrift)                              |
| **Phase B**   | B.2.1 Step 1 Document Intelligence         | [x] Abgeschlossen | Layout-Aware Block-Parsing (`layout-structure-parser.ts`) & Verifiable Fact-Checking (`verifiable-fact-checker.ts`)  |
| **Phase B**   | B.3 SSE Teilfortschritt-Streaming          | [x] Abgeschlossen | Server-Sent Events Stage-Updates live in die Cockpit-Oberfläche                                                      |
| **Phase B**   | B.4 Worker-Daemon & Zombie-Sweeper         | [x] Abgeschlossen | Graceful Shutdown (`SIGTERM`/`SIGINT`) & automatisches Recovery verwaister Jobs nach Lease-Timeout                   |
| **Phase B**   | B.5 Supabase Database Webhooks             | [x] Abgeschlossen | Ereignisgesteuerte Aktivierung (`trigger_dossier_job_pending`) via Shared-Secret Webhook                             |
| **Phase B**   | B.6 Vercel Webhook Live-Schaltung          | [x] Abgeschlossen | Produktionseinsatz auf `notar-agent.vercel.app` mit `SUPABASE_WEBHOOK_SECRET`                                        |
| **Phase B**   | B.8.2 Zitat-Grounding via diff-match-patch | [x] Abgeschlossen | Bit- & zeichengenaue Fundstellen-Verifikation (§ 17 BeurkG), Hyphenation-Toleranz & Anti-Halluzinations-Herabstufung |
| **Phase C**   | C.1 Append-Only Audit-Trail (§ 17 BeurkG)  | [x] Abgeschlossen | Revisionssichere `audit_logs` Tabelle mit SHA-256 Hash-Chaining & Pflichtbegründungen                                |
| **Phase C**   | C.2 PostgreSQL RLS Mandantentrennung       | [x] Abgeschlossen | Kernel-Level Row-Level Security (§ 203 StGB), Zod Notar-Rollen & `organization_id` Isolation                         |
| **Phase C**   | C.3 Kanzlei- & DNotI-RAG (pgvector + BM25) | [x] Abgeschlossen | Hybrid-Suche, `seed-knowledge.ts` für Amtsgericht-Präzedenzen & RLS-Klauselsammlung                                  |
| **Additions** | Modul 10 Kanzlei-Auth & Rollen-UI          | [x] Abgeschlossen | Login (`/login`), Session-Guard Middleware, Header-Rollenbadge & Team-Settings-View                                  |
| **Additions** | Modul 12 Fail-Fast Repository-Architektur  | [x] Abgeschlossen | Bereinigung stiller Fallbacks in Repositories (PostgreSQL als Single Source of Truth)                                |
| **Additions** | Modul 13 Codebase Health & Quality Gates   | [x] Abgeschlossen | AST-Komplexitäts-Auditor (`repo-health.mjs`), 94/100 Health Score, PII/N+1 Invarianten & harter 90%-CI-Abbruch       |

---

## 🔍 Detaillierte Meilenstein-Dokumentation

### Phase A: Fachlicher Kernnutzen & Basis-Qualität

#### 1. Architektur-Fundament & Guardrails

- **Separation of Policy and Mechanism:** Materielle Rechtsregeln verbleiben in der Datenbank (`knowledge_documents`), technische Strukturen in `src/lib/dossier/`, Matching in `src/lib/knowledge/`.
- **Statische Architektur-Invarianten:** Dependency-Cruiser Invarianten sichern die unidirektionale Datenflussrichtung (`types` $\rightarrow$ `lib` $\rightarrow$ `app/components`).
- **Zero Magic Strings:** Alle Domänen-Zustände (`CaseType`, `FieldStatus`, Notar-Rollen) sind strikt typisiert.

#### 2. RAG-Auditor (JIT Rule Retrieval – Phase A.2)

- Vollständige Regel-Registry (`src/lib/knowledge/rules-registry.ts`) für gesetzliche Prüfnormen (GEG 10-Jahres-Frist, BeurkG § 17, HGB Vertretung, GBO Vormerkung).
- Deterministischer Selektor (`rule-selector.ts`) analysiert Vorab-Merkmale aus Stufe 1 und injiziert nur die hochrelevanten Normen in den Prompt von Stufe 2.

#### 3. Playwright E2E Test-Automation (Phase A.1)

- Lückenloser Headless-Test (`e2e/smoke-workflow.spec.ts`): Multi-File-Upload $\rightarrow$ Stepper-Fortschritt $\rightarrow$ FieldCockpit $\rightarrow$ Status-Override $\rightarrow$ Export.
- Vollständige Unabhängigkeit von externen Live-APIs durch deterministische Fixtures.

#### 4. Evaluations- & Benchmark-Suite (Phase A.4.1 & A.4.2)

- **Golden Dataset:** 8 kanonische Akten (`src/test/eval/golden-dataset.ts`) mit Ground Truth für 10 Pflichtfelder, Widersprüche und Randfälle.
- **Scorer & Metriken:** P50-, P90-, P95- und P99-Latenzen, Token-Kosten und Provenance-Quote (`scripts/eval-pipeline.ts`).
- **Promptfoo Matrix:** Lokales Web-Dashboard (`npm run eval:view`) für Side-by-Side Modellvergleiche (Gemini Flash vs. Claude Sonnet).

---

### Phase B: Asynchrone Skalierung & Resilienz

#### 1. PostgreSQL Job-Queue (`dossier_jobs` – Phase B.1)

- Beseitigung von HTTP-Timeouts bei Großakten (50–200 Seiten). Der Upload antwortet in **< 250 ms** mit `202 Accepted`.
- Transaktionssichere Zustandsverwaltung (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) mit Concurrency-Steuerung via `FOR UPDATE SKIP LOCKED`.

#### 2. Dual-Stream Ingestion Pipeline (Phase B.2 & B.2.1)

- Introspektion auf Byte-Ebene (`pdf-stream-classifier.ts`):
  - Digital-Born PDFs nutzen die direkte verlustfreie Unicode-Textextraktion (< 10 ms, null Ziffern- oder Tippfehler bei Beträgen/Flurstücken).
  - Scans und Bildträger nutzen Multimodal Vision (Gemini / Claude).
  - Hybride Dokumente kombinieren beide Ströme.
- **Step 1 Document Intelligence:**
  - Layout- und strukturierte Block-Erkennung (`layout-structure-parser.ts`) mit automatischer Rekonstruktion mehrspaltiger Tabellen und Klauseln.
  - Deterministischer Fakten- und Zitationsprüfer (`verifiable-fact-checker.ts`), der Snippets auf wortwörtliche Existenz im Originaldokument und mathematische Beträge (Kaufpreis vs. Raten) verifiziert.
  - Dynamische Modell-Governance (`src/env.ts`, `ai-provider.ts`) mit Fail-Fast-Validierung ohne statische Mappings.

#### 3. SSE Live-Streaming & Worker-Daemon (Phase B.3 & B.4)

- Server-Sent Events übermitteln Stufen-Updates (`PAGE_SPLITTING`, `EXTRACTION`, `AUDITING`) in Echtzeit an das Cockpit.
- Entkoppelter Hintergrund-Daemon mit Graceful Shutdown und automatischem Zombie-Sweeper für verwaiste Jobs nach Lease-Timeout.

#### 4. Event-Triggered Orchestration via Supabase Webhooks (Phase B.5 & B.6)

- PostgreSQL-Trigger `trigger_dossier_job_pending` feuert bei neuen Jobs kryptografisch gesicherte Webhooks (`x-webhook-secret`) an den Worker.
- Auf Vercel live geschaltet (`notar-agent.vercel.app/api/jobs/process-webhook`).

#### 5. Deterministisches Zitat-Grounding via diff-match-patch (§ 17 BeurkG – Phase B.8.2)

- Bit- und zeichengenaue Verifikation von KI-extrahierten Quellennachweisen (`source.snippet`) gegen Rohdokument-Texte (`citation-matcher.ts`).
- Fehlertolerantes Bitap-Fuzzy-Matching bei variierenden Zeilenumbrüchen, Leerraumschwankungen und OCR-Silbentrennung am Zeilenende ("-\n").
- Anti-Halluzinations-Schutz: Freierfundene oder unauffindbare Zitate werden deterministisch auf `NEEDS_REVIEW` herabgestuft und als `VerificationIssue` erfasst.
- Bei verifiziertem Fuzzy-Match wird das tatsächliche Originaltext-Snippet aus dem Dokument übernommen, um bitgenaue Provenance für den Urkundenprüfbericht sicherzustellen.

---

### Phase C: Enterprise Compliance & Mandantenisolation

#### 1. Revisionssicherer Audit-Trail gem. § 17 ff. BeurkG (Phase C.1)

- Unveränderliche Tabelle `audit_logs` mit SHA-256 Hash-Chaining (Verkettung jedes Eintrags mit dem vorherigen Hash).
- Zwingende Begründungspflicht bei manuellen Korrekturen von Warnungen (`StatusOverrideReasonModal`).
- Vollständiger kryptografischer Fingerprint im exportierten Prüfbericht.

#### 2. Kernel-Level Row-Level Security (§ 203 StGB – Phase C.2)

- PostgreSQL RLS auf allen relevanten Tabellen (`dossiers`, `documents`, `audit_logs`, `dossier_jobs`).
- Strikte Kanzlei-Isolation anhand von `organization_id` direkt im DB-Kernel; kein Datenabfluss im Multi-Tenant-Betrieb möglich.

#### 3. Kanzlei- & DNotI-Wissensbasis (Hybrid RAG – Phase C.3)

- `pgvector`-Schema in Supabase kombiniert mit BM25-Schlagwortsuche für Paragraphen.
- Amtsgericht-Präzedenzdatenbank zur Vermeidung lokaler Zwischenverfügungen.

#### 4. Kanzlei-Authentifizierung & Rollen-UI (Additions Modul 10)

- Supabase Auth Login-Page (`src/app/login/page.tsx`) mit Server-Session Middleware Guard.
- Kanzlei-Header mit interaktivem Notar-Rollen-Switcher (`NOTAR`, `NOTARASSESSOR`, `SACHBEARBEITER`, `ANWALTSNOTAR_RA`, `ADMIN`).
- Team- und Rollenverwaltungs-View (`src/components/views/TeamSettingsView.tsx`).

#### 5. Fail-Fast Repository-Architektur (Additions Modul 12)

- Eliminierung aller stillen `catch`-Fallbacks in `SupabaseDossierRepository`, `SupabaseJobRepository` und `SupabaseKnowledgeRepository`.
- PostgreSQL fungiert ausnahmslos als Single Source of Truth mit deterministischem `throw new Error(...)` bei Störungen.

#### 6. Codebase Health, AST-Komplexität & Deterministische Quality Gates (Additions Modul 13)

- Etablierung des deterministischen Health-Auditors (`scripts/audit/repo-health.mjs`) mit automatischer Ausführung in `npm run check`.
- Anhebung des Codebase Health Scores von 89 auf **94 / 100** durch Entflechtung imperativer Hotspots in Repositories, Fact-Checkern und Parsing-Modulen.
- Eliminierung von Codeduplikaten in Dialog- und Authentifizierungs-Views über das wiederverwendbare Radix-Primitive `BaseModalShell`.
- Automatischer Schutz vor PII-Leaks (§ 203 StGB) durch Verbot von `console.log` im Produktionscode.
- Automatischer Performance-Guard gegen N+1-Datenbankabfragen innerhalb von Schleifenkörpern (`for`, `while`, `for await`).
- Harter CI-Abbruch bei Unterschreitung des Schwellenwerts von 90/100 Punkten sowie verbindliche Verankerung ereignisgesteuerter Refactoring-Trigger in `AGENTS.md`.
