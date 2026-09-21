# Architektur-Roadmap für den skalierenden Live-Betrieb (Notariat 24/7)

> **Dokumentstatus:** Zentrale Architektur-Spezifikation für die Produktivüberführung (Single Source of Truth)  
> **Bezugssystem:** NotarPartner Urkunden-Zuarbeit (Next.js 16, TypeScript, Claude Vision, Supabase)

---

## 1. Executive Summary: Vom Prototyp zum Enterprise-Kanzleisystem

Der vorliegende Prototyp beweist die fachliche Machbarkeit: Heterogene Urkundensätze werden über einen 2-stufigen Agenten-Workflow (Extraction + Notary Auditor) rechtssicher, auditierbar und mit Human-in-the-Loop aufbereitet.

Für den **Produktivbetrieb in Notariaten** mit täglichen Lastspitzen, Großaktenbänden (50–200 Seiten), strengsten Berufsgeheimnis-Vorgaben (§ 203 StGB / § 18 BNotO) und dem Anspruch auf echte Arbeitserleichterung im Kanzleialltag definiert dieses Dokument die Kernsäulen der Ziel-Architektur sowie einen nach **technischem ROI und Abhängigkeiten priorisierten Phasenplan**:

1. **Fachliche Kern-Module:** RAG-gestützter Auditor, automatisierte Mandantenkorrespondenz und Post-Beurkundungsvollzug (Word-Urkundengenerierung optional / siehe Additions).
2. **Qualitäts-Fundament & Kanzlei-Compliance:** Playwright E2E-Automation, revisionssicherer Audit-Trail & Zero-Data-Retention (ZDR).
3. **Provider-Flexibilität & Kostensenkung:** Multi-LLM Adapter (Bedrock, Azure, Local vLLM) und hybrides OCR/Vision-Pre-Filtering (60–75 % Ersparnis).
4. **Asynchrone Hintergrundverarbeitung:** PostgreSQL-basierte Job-Queue (`dossier_jobs` mit PENDING/PROCESSING/COMPLETED/FAILED) zur Beseitigung von HTTP-Timeouts bei Großakten mit Live-Status (SSE).
5. **Mandantenfähigkeit & Kanzlei-Isolation:** PostgreSQL Row-Level Security (RLS) zur hermetischen Trennung fremder Kanzleidaten (§ 203 StGB).
6. **Ökosystem & Fachverfahren:** Standardisierter XJustiz- / XNP-Export zur medienbruchfreien Integration in TriNotar, NoRA, Notar 4.0 und RA-MICRO sowie Rechtsgebiets-Expansion.

---

## 2. Fachliche Kern-Module (The Notary Core)

### 2.1 Enterprise Legal Processing Pipeline & Notary Auditor (5-Stufen-Architektur)

- **Zielkomponente:** `Notary Auditor & Reconciler` in `src/app/api/analyze/route.ts` & `src/lib/ai/pipeline.ts`
- **Architektur-Spezifikation:** [docs/architecture/enterprise-legal-processing.md](./docs/architecture/enterprise-legal-processing.md)
- **Kernnutzen:** **Maximale juristische Verlässlichkeit (Zero Hallucinations bei Zahlen & Fristen)**, **70–90 % Kostenersparnis durch Gemini Flash Kontext-Caching** und lückenlose Beweissicherung.

#### Das 5-Stufen Enterprise-Modell (Harvey AI / Robin AI / CoCounsel Benchmark)

```mermaid
graph TD
    A[Akten-Upload: Scans, PDFs, Notizen] --> B[1. Pre-Flight Ingestion Gateway: OCR-Quality, Typ-Triage, Relevanz]
    B --> C[2. Dual-Stream Extraction: Unicode-Text + High-Res Vision für Siegel/Handschrift]
    C --> D[3. Fact Store: Unteilbare Fakten mit Text-to-Bounding-Box Provenienz]
    D --> E[4. Dual-Engine Verification: Deterministische Code-Engine + LLM-Rechtsauditor]
    E --> F[5. Governance & Gate: Zod-Verträge, Confidence-Scoring, Inquiries]
```

#### Kosten- & Latenz-Hebel: Gemini Flash & Kontext-Caching

- **Gemini Flash Pricing:** $0,75 / 1 Mio. Input, $3,75 / 1 Mio. Output.
- **Kontext-Caching:** $0,075 / 1 Mio. Cached Input (-90 % Kosten!), $0,50 / 1 Mio. Tokens/Std. Speicherpreis.
- **Akten-Ökonomie:** 40-seitige Notarakte kostet beim Erstupload ca. $0,054 (5 Cent). Jede Nachreichung oder Reconciler-Stufe kostet dank Kontext-Caching unter **$0,008 (< 1 Cent)**.
- **Volle Vision-Sicherheit:** Durch die extrem günstigen Token-Preise müssen keine gefährlichen Kompromisse bei Scans oder Handschriften eingegangen werden – jede Seite wird multimodal voll verarbeitet.

#### Wissensbasis (Database-First SSOT)

1. **Gesetzliche Prüfnormen:** BGB, BeurkG, GBO, GEG (10-Jahres-Frist), MaBV, HGB (in `knowledge_documents`).
2. **Kanzlei-Standards:** Interne Checklisten nach Vorgangstyp (Gewerbekauf, Überlassung, WEG).
3. **Zwischenverfügungs-Prävention:** DNotI-Gutachten und historische Beanstandungen lokaler Grundbuchämter.

#### Phasenweise Umsetzung der 5-Stufen-Pipeline

- **Phase 1 (Quick Win):** [x] **Fertiggestellt & Verifiziert** — Database-First SSOT in PostgreSQL (`knowledge_documents`), Code vollständig frei von Gesetzes-Strings, dynamische Injektion in Stufe 2 via `rule-selector.ts`.
- **Phase 2 (Dual-Engine Guardrails & Zod Contract):** [ ] Deterministische Guardrails (Fristen & Mathematik in TS), Zod-Verträge zwischen Stufe 1 & Stufe 2, Entity-Reconciliation.
- **Phase 3 (Pre-Flight Gateway & Gemini Kontext-Caching):** [ ] Dokumenten-Triage & Relevanz-Prüfung vor Extraktion, Gemini Ephemeral Context Caching für Stufe-1/Stufe-2 Wiederverwendung.
- **Phase 4 (Deep Provenance):** [ ] Paginierte Beleg-Verankerung auf dem PDF-Textlayer für 1-Klick-Auditing.
- **Phase 5 (Enterprise Ingestion & Extraction Overhaul):** [ ] Serverless-native Modernisierung von Stufe 1 (100 % Vercel + Supabase kompatibel, zero extra Container): Modulare, flache Sub-Schemas & „Reasoning-First“-Pattern (Schutz vor Thinking Degradation / Datenverlust), Gemini Flash Multimodal Vision für Tabellen & Google `diff-match-patch` für 100 % Belegnachweis (§ 17 BeurkG).

---

### 2.2 Word-Urkunden-Engine (Ausgelagert ins Backlog)

> **Hinweis:** Dieser Baustein wurde als nachgelagertes/optionales Feature eingestuft und in [ARCHITECTURE_ROADMAP_ADDITIONS.md](./ARCHITECTURE_ROADMAP_ADDITIONS.md) archiviert. Der Fokus liegt primär auf rechtssicherer Prüfung, Konsistenz-Audit und asynchroner Großakten-Verarbeitung.

---

### 2.3 KI-Mandantenkorrespondenz & Entwurfsversand

- **Ziel:** Automatisierte, individuelle Begleitschreiben und Entwurfs-E-Mails an Mandanten, Makler und Banken (Schritt 03 auf beta.notarpartner.de).
- **Rechtssichere Hinweise:** Schreiben werden dynamisch aus dem Dossier generiert (z. B. konkreter Hinweis an den Käufer auf die gesetzliche 14-tägige BGB-Verbraucherprüffrist gem. § 17 Abs. 2a BeurkG).
- **Automatisierter Adressaten-Filter:**
  - _An Käufer/Verkäufer:_ Verständliche Erläuterung der nächsten Schritte (Fälligkeitsvoraussetzungen, Übergabe).
  - _An finanzierende Bank:_ Gezielte Übersendung des Grundschuldentwurfs mit Treuhandauflagen-Bestätigung.
- **Audit-Konnexität:** Revisionssichere Archivierung aller versendeten Entwürfe und Begleitschreiben.

---

### 2.4 Beschleunigte Abwicklung & Vollzug (Post-Beurkundung)

- **Ziel:** Automatisierung der Nachbereitungs- und Vollzugsphase nach der Beurkundung (Schritt 04 auf beta.notarpartner.de).
- **Automatisierte Behörden- & Vollzugssätze auf Knopfdruck:**
  - **Grundbuchamt:** Anträge auf Eigentumsvormerkung, Eigentumsumschreibung und Grundschuldeintragung.
  - **Gemeinde / Finanzamt:** Anforderung der Vorkaufsrechtsverzichtserklärung (§ 28 BauGB) und Unbedenklichkeitsbescheinigung.
  - **Fälligkeitsmitteilung:** Präzise Berechnung von Zahlungsziel, Bank-IBANs und Treuhandabzügen nach Eintritt aller Voraussetzungen.

---

## 3. Qualitäts-Fundament & Kanzlei-Compliance (Test-First)

### 3.1 Vollständige E2E-Testsuite mit Playwright

Bevor infrastrukturelle Umbauten anstehen, sichert eine Ende-zu-Ende-Testsuite das Kernverhalten des Sachbearbeiter-Workflows ab:

1. **Upload großer Aktenpakete:**
   - Multi-File-Drag-and-Drop (6–10 PDFs gleichzeitig) unter realistischen Netzwerkbedingungen.
2. **Kollaboratives Human-in-the-Loop:**
   - Simuliertes Überschreiben eines Feldwertes durch den Sachbearbeiter (z. B. manueller Status-Wechsel von `NEEDS_REVIEW` auf `VERIFIED`).
   - Verifikation, dass manuelle Korrekturen den Audit-Trail nicht beschädigen.
3. **Barrierefreiheit & Keyboard-Navigation:**
   - Volle Bedienbarkeit der Cockpit-Tabelle via Tastatur (WCAG 2.1 AA Konformität für Kanzleiarbeitsplätze).
4. **UI/UX-Polishing & Responsiveness:**
   - Überführung der prototypischen Oberfläche in ein voll ausgereiftes Kanzlei-Designsystem (Abstände, Ladezustände, Feedback-Banner, Begleitansicht).

### 3.2 Revisionssicherer Kanzlei-Audit-Trail & Beweissicherung (§ 17 ff. BeurkG)

Da der Notar persönlich für den Urkundeninhalt haftet, protokolliert eine Append-Only-Tabelle in PostgreSQL gerichtsfest jeden Bearbeitungsschritt:

```mermaid
graph LR
    A["Dokumenten-Upload"] -->|"SHA-256 Hash"| B[("Original-Hash")]
    B --> C["Stufe 1 & 2 Analyse"]
    C -->|"KI-Vorschlag"| D[("Audit-Log: KI_SUGGESTION")]
    D --> E{"Sachbearbeiter-Eingriff?"}
    E -->|"Status überschrieben"| F[("Audit-Log: USER_OVERRIDE")]
    E -->|"Unverändert übernommen"| G[("Audit-Log: VERIFIED_BY_USER")]
    F --> H["Revisionssicherer Prüfbericht"]
    G --> H
```

- **Inhalt jedes Audit-Eintrags:**
  - Zeitstempel (UTC ISO-8601), User-ID und Kanzlei-ID.
  - Betroffenes Feld (`fieldKey`) sowie Vorher-/Nachher-Zustand.
  - Zwingende Pflichtbegründung bei manuellem Überschreiben von Warnungen (`NEEDS_REVIEW` -> `VERIFIED`).
  - SHA-256-Fingerprint der zugrundeliegenden Quelldatei.

### 3.3 Agentic Workflow Evaluation & Benchmark Suite (Latenz-Perzentile, Real-World-Korpus & Promptfoo)

Um iterative Code- und Prompt-Anpassungen im 2-Stufen-Agentic-Workflow verlässlich und quantitativ zu bewerten, besitzt das System eine dedizierte Evaluations- und Benchmark-Suite:

1. **Synthetisches Referenz-Dataset (Ground Truth):**
   - 5 kanonische synthetische Text-Referenzakten in `src/test/eval/golden-dataset.ts` decken Standardfälle, Erbenwidersprüche, abgelaufene Fristen (§ 80 GEG), Flächendiskrepanzen und Miet-Arithmetik ab.
   - Vollständige Isolierung vom echten Kanzleibetrieb (§ 203 StGB: Testdaten berühren niemals Produktionsdatenbanken).
2. **Enterprise Real-World Testkorpus (Dreckeffekte & Bildträger):**
   - **Reale Kanzleistörungen:** Gezielte Testfälle mit unscharfen Personalausweiskopien, schiefen und kontrastarmen Scans, unleserlichen Stempeln/Siegeln und handschriftlichen Randnotizen auf Urkundenseiten.
   - **Defekte & unvollständige Anhänge:** Fehlende Seiten in Grundbuchauszügen und unvollständige Vollmachten.
   - **Nachforderungs-Validierung:** Verifikation, dass das Modell bei unleserlichen Belegen deterministisch `NEEDS_REVIEW` setzt und eine präzise Nachforderung (`inquiries`) an die Sachbearbeitung auslöst.
3. **Quantitative Ziel-Metriken (Quality Gates):**
   - **Genauigkeit (Ground Truth Accuracy):** Soll $\ge$ 95.0 % Feld-Übereinstimmung der 10 Pflichtfelder.
   - **Provenance Coverage:** Soll 100.0 % (jede Extraktion mit Quelldatei und Beleg-Snippet belegt).
   - **Guardrail-Trefferquote:** Soll 100.0 % (Fristen und Widersprüche deterministisch abgefangen).
   - **Latenz-Perzentile:** P50 (Median), P90, P95 und P99 (Worst-Case) aufgeschlüsselt nach Stufe 1 (Extraktion) und Stufe 2 (Auditor).
   - **Token-Ökonomie & Kostenprojektion:** Exakte Berechnung des Token-Verbrauchs und Hochrechnung der Vorgangskosten (z. B. Gemini 3.8 Flash Tarif: 0,075 $ / M Input, 0,30 $ / M Output).
4. **Automatisierte In-Repo-Ausführung (`npm run eval`):**
   - 0,00 € Offline-Replay-Modus in < 20 ms für CI/CD-Pre-Commit-Schutz.
   - Live-Modus (`npm run eval:live`) mit Cooldown und Rate-Limit-Schutz gegen Google AI Studio.
5. **Nächster Ausbauschritt: `promptfoo` Matrix- & Dashboard-Integration:**
   - Evaluierung und Integration des Open-Source-Standards `promptfoo` (`npm i -D promptfoo`) als alternatives CI/CD- und Visualisierungs-Tool.
   - Erstellung einer `promptfooconfig.yaml` zur Gegenüberstellung verschiedener Prompts und Modelle (z. B. Gemini 3.8 Flash vs. Claude 3.5 Sonnet vs. GPT-4o) im lokalen Browser-Dashboard (`npx promptfoo view`).
   - Wiederverwendung der bestehenden Notar-Scorer (`src/test/eval/scorer.ts`) als typisierte Custom-Assertions in Promptfoo.

### 3.4 Zero-Data-Retention (ZDR) Vertragskonfiguration (Ausgelagert ins Backlog)

> _Hinweis: Die vertragliche Konfiguration von ZDR-Vereinbarungen (Cloud Contractual mit Anthropic / AWS / Google Cloud) wurde ins Backlog ausgelagert (siehe [ARCHITECTURE_ROADMAP_ADDITIONS.md](./ARCHITECTURE_ROADMAP_ADDITIONS.md)). Der technische Revisionsschutz ist durch Phase C.1 (Append-Only Audit-Trail) vollständig realisiert._

---

## 4. Ingestion-Pipeline & Zeichenintegrität

> _Hinweis: Das Thema Multi-LLM Provider-Adapter (AWS Bedrock / Azure / vLLM) wurde ins Backlog ausgelagert (siehe [ARCHITECTURE_ROADMAP_ADDITIONS.md](./ARCHITECTURE_ROADMAP_ADDITIONS.md))._

### 4.1 Dual-Stream Ingestion Pipeline (Industriestandard für Zeichenintegrität & Vision)

> **Architektur-Spezifikation (Dual-Stream / Hybrid Ingestion):**  
> Der Einsatz einer hybriden Pipeline dient im Notariat **primär der absoluten Zeichenpräzision (Zero OCR-Tippfehler bei Kaufpreisen, IBANs und Flurstücken)** sowie sekundär der Geschwindigkeits- und Durchsatzoptimierung:
>
> - **1. Digital-Born PDF (Reiner Textlayer, keine Rasterbilder):** Extrahiert den Unicode-Text direkt verlustfrei (< 10 ms). Mathematisch ausgeschlossene Fehlinterpretationen bei sensiblen Ziffernfolgen (`1.250.000 €`, `HRB 20459`, `Flur 12, Flurstück 108/4`).
> - **2. Scans / Bildträger (Reine Bildseiten, kein Text):** Multimodales Vision-Routing (Gemini 3.x Flash / Claude Vision) für unübertroffenes Kontextverständnis bei Handschriften, Siegeln und Stempeln.
> - **3. Hybride Dokumente (Digitaler Text + eingescannte Siegel/Signaturen):** Dual-Stream Fusion – Übergabe sowohl des exakten Unicode-Textlayers als auch der Bild-Payloads an das Modell mit striktem Abgleich.

```mermaid
graph TD
    A["Eingehendes PDF / Dokument"] --> B["PDF-Objekt-Introspektion (Byte-Ebene)"]
    B --> C{"Layout- & Stream-Klassifikation"}
    C -->|"1. Digital-Born Text (0 Rasterbilder)"| D["Direct Unicode Text Extraction"]
    C -->|"2. Reines Rasterbild (Scan/Fax, 0 Text)"| E["Multimodal Vision Pipeline"]
    C -->|"3. Hybrid (Text + Siegel/Signaturen)"| F["Dual-Stream Fusion (Text + Bild)"]
    D --> G["Verlustfreier Text-Payload (< 10 ms, Zero Ziffernfehler)"]
    E --> H["High-Res Vision Tokens für Handschrift & Siegel"]
    F --> I["Gleichzeitige Übergabe: Textlayer + Bildverifikation"]
    G & H & I --> J["Notary Extraction & Audit Agent"]
```

- **Effekt:** 100 % mathematische Zeichenexaktheit bei Urkundendaten, maximale Ausfallsicherheit bei Stempeln/Handschriften und drastisch schnellere Verarbeitung digitaler Entwürfe.

---

## 5. Asynchrone Hintergrundverarbeitung (PostgreSQL Job-Queue)

### 5.1 Problemstellung im Kanzleialltag

| Problem                      | Auswirkung ohne Queue (Synchron)                                                                                             | Lösung mit PostgreSQL-Queue (`dossier_jobs`)                                                                                        |
| :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP-Timeouts**            | Proxies (Cloudflare/Nginx/Vercel) kappen Verbindungen nach 30–60 s. Ein 100-Seiten-Lauf bricht mit `504 Gateway Timeout` ab. | Der HTTP-Upload antwortet in **< 250 ms** mit `202 Accepted` (`status: PENDING`). Die Verarbeitung läuft entkoppelt im Hintergrund. |
| **Tab-Schließung / Abbruch** | Sachbearbeiter schließt das Browser-Fenster -> Lauf bricht ab, teure LLM-Tokens sind verbrannt.                              | Jobs persistieren transaktionssicher in Postgres; der Sachbearbeiter kann den Rechner wechseln oder herunterfahren.                 |
| **Peak-Load & Rate Limits**  | Wenn morgens um 09:00 Uhr 8 Mitarbeiter gleichzeitig Akten hochladen, drohen `429 Rate Limits` oder RAM-Crash.               | **Concurrency Control:** Worker greift Jobs gezielt via `FOR UPDATE SKIP LOCKED`; Überhang wartet geordnet im Status `PENDING`.     |
| **Transiente API-Fehler**    | KI-Server überlastet (`529 Overloaded`) -> Vorgang scheitert.                                                                | Automatischer **Retry-Zähler** im Job-Record mit markiertem `FAILED`-Status und präziser Fehlerursache.                             |

### 5.2 Technisches Design & Job-Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Upload empfangen (< 250ms, 202 Accepted)
    PENDING --> PROCESSING: Worker greift Job (Stufe 1 Extraction)
    PROCESSING --> PROCESSING: Stage-Update (Stufe 2 RAG-Auditor)
    PROCESSING --> COMPLETED: Transaktionssicher im Dossier persistiert
    PROCESSING --> FAILED: LLM Timeout / Unleserlicher Scan
    FAILED --> PENDING: Manueller oder automatischer Retry
    COMPLETED --> [*]
```

```mermaid
sequenceDiagram
    autonumber
    actor Notar as Sachbearbeiter / Notar
    participant UI as Cockpit Frontend
    participant API as Next.js API (Ingestion)
    participant DB as Postgres (dossier_jobs & dossiers)
    participant Worker as Background Worker (Node.js / Route Handler)
    participant LLM as Anthropic Claude API

    Notar->>UI: Upload Dokumentensatz (z.B. 120 Seiten PDF)
    UI->>API: POST /api/dossiers/upload
    API->>DB: Job anlegen: status = 'PENDING', payload = { files, caseType }
    API-->>UI: 202 Accepted { jobId, status: "PENDING" }

    Note over UI,API: Sofortige Entlastung des Webservers (< 250ms)
    UI->>API: SSE-Stream / Polling (/api/dossiers/jobs/:id/status)

    rect rgb(240, 248, 255)
    Note over DB,Worker: Asynchrone Worker-Pipeline
    Worker->>DB: Job abholen (SELECT ... FOR UPDATE SKIP LOCKED) -> status = 'PROCESSING'
    Worker->>DB: Status: { stage: "PAGE_SPLITTING", progress: 15% }
    Worker->>Worker: Hybrides OCR / Vision-Chunking
    Worker->>DB: Status: { stage: "EXTRACTION", progress: 45% }
    Worker->>LLM: Stufe 1: Extraction Agent
    LLM-->>Worker: Roh-Dossier
    Worker->>DB: Status: { stage: "AUDITING", progress: 80% }
    Worker->>LLM: Stufe 2: Notary Auditor & Reconciler
    LLM-->>Worker: Finales Delta
    end

    Worker->>DB: Status = 'COMPLETED', Dossier & Audit-Trail persistieren
    UI->>Notar: Cockpit-Tabelle fertig gerendert anzeigen
```

### 5.3 Produktionsfester Worker-Lifecycle & Ausfallsicherheit (Daemon & Orphan Recovery)

Im Prototyp wird die Hintergrundverarbeitung über `void executeDossierJob(job.id)` im Next.js-Prozess angestoßen. Für den 24/7-Kanzleibetrieb erfordert dies eine robuste Entkopplung:

1. **Eigenständiger Worker-Daemon (Decoupled Runner):**
   - Entkopplung vom Next.js-Web-Container in einen dedizierten Node.js-Worker-Prozess (oder systemd/Docker-Container).
   - Sauberes **Graceful Shutdown (`SIGTERM`/`SIGINT`)**: Laufende LLM-Pipelines erhalten ein Abbruchsignal (AbortController); der Job-Status wird geordnet auf `PENDING` zurückgesetzt statt zerstört zu werden.
2. **Orphan-Job Recovery & Lease-Timeout (Zombie-Sweeper):**
   - Stürzt ein Worker-Container während einer laufenden Analyse unerwartet ab (z. B. Out-of-Memory oder VM-Neustart), bleibt der Job nicht dauerhaft auf `PROCESSING` blockiert.
   - Ein periodischer Sweeper prüft `locked_at`: Ist ein Job länger als das konfigurierte Lease-Timeout (z. B. 5 Minuten) im Status `PROCESSING` ohne Lebenszeichen, wird er automatisch zur Wiederholung freigegeben (`status = 'PENDING'`, Retry-Zähler erhöht) oder nach 3 Fehlversuchen als `FAILED` markiert.

### 5.4 Serverlose Event-Orchestrierung via Supabase Database Webhooks (Enterprise-Standard)

Um dauerhaft laufende Polling-Prozesse (`setInterval(2000)`) abzulösen, ist die Architektur auf native **Supabase Database Webhooks** umgestellt:

- **Ereignisgesteuerte Aktivierung:** Sobald ein Job mit Status `PENDING` erstellt wird, feuert ein PostgreSQL-Trigger (`trigger_dossier_job_pending`) via Supabase einen HTTP POST-Aufruf an `/api/jobs/process-webhook`.
- **Kryptografische Absicherung:** Authentifizierung über Header `x-webhook-secret` gegen das generierte `SUPABASE_WEBHOOK_SECRET`.

#### Anleitung zur Live-Schaltung nach Deployment (Checkliste):

1. **Applikation bereitstellen (Domain erhalten):**
   - App auf Vercel, Hetzner oder Dokploy deployen (z. B. Domain `https://mein-notariat.vercel.app`).
2. **Umgebungsvariablen im Hosting-Dashboard hinterlegen:**
   - `SUPABASE_WEBHOOK_SECRET="8f502e1289c87f03a0168939134332a4ffb7aaf92649f35aca1426536ef3e36c"`
3. **Webhook im Supabase Dashboard aktivieren:**
   - Navigiere zu: **Database > Webhooks** $\rightarrow$ **Create a Webhook**.
   - **Name:** `dossier-jobs-processor`
   - **Table:** `dossier_jobs`
   - **Events:** `Insert`, `Update`
   - **Target URL:** `https://<deine-produktions-domain>/api/jobs/process-webhook`
   - **HTTP Header:** Name `x-webhook-secret`, Wert `8f502e1289c87f03a0168939134332a4ffb7aaf92649f35aca1426536ef3e36c`.

---

## 6. Mandantenfähigkeit (Multi-Tenancy) & Kanzlei-Isolation (§ 203 StGB)

### 6.1 Das berufsrechtliche Gebot der strikten Trennung

Notariate unterliegen der berufsrechtlichen Verschwiegenheitspflicht (§ 18 BNotO) und dem strafbewehrten Berufsgeheimnis (§ 203 StGB). In einem mandantenfähigen Cloud-Setup darf unter keinen Umständen ein Datenabfluss zwischen verschiedenen Kanzleien (Tenants) oder innerhalb einer Sozietät bei Mandatskonflikten möglich sein.

### 6.2 Technisches Design: Row-Level Security (RLS) in PostgreSQL

Statt die Mandantentrennung fehleranfällig im Applikationscode zu verwalten, setzt die Ziel-Architektur auf **PostgreSQL Row-Level Security (RLS)** auf Datenbank-Kernel-Ebene:

```sql
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON dossiers
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
```

### 6.3 Reproduzierbares Migrations- & Index-Management (Postgres & Supabase)

Für verlässliche CI/CD-Deployments und performante Datenbankabfragen bei wachsenden Kanzleiarchiven:

1. **Versionierte Migrationen (`supabase/migrations/`):**
   - Sämtliche Tabellen (`documents`, `audit_logs`, `dossier_jobs`), Enums und RLS-Policies werden deklarativ versioniert verwaltet und automatisiert über CI angewendet.
2. **Index-Strategie:**
   - `audit_logs`: B-Tree auf `(document_id, sequence_number)` zur schnellen kryptografischen Kettenprüfung.
   - `dossier_jobs`: Partieller Index auf `(status, created_at) WHERE status = 'PENDING'` für extrem schnelles Queue-Polling via `FOR UPDATE SKIP LOCKED`.
3. **Connection Pooling & Pooling-Port:**
   - Trennung zwischen Transaction-Pooler (Supavisor / PgBouncer Port 6543) für transiente Queue- und Audit-Writes und Session-Modus für Migrationen.

### 6.4 Rollen- und Rechtematrix (Kanzlei-RBAC)

| Rolle                                        | Berechtigungen im System                                                                                                                                    |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notar / Notarassessor**                    | Vollzugriff: Letztentscheidung über Freigaben, finale Status-Overrides, Export in Fachverfahren, Einsicht in unveränderliche Audit-Logs.                    |
| **Notarfachangestellte(r) / Sachbearbeiter** | Operativer Zugriff: Akten-Upload, Klärung von `NEEDS_REVIEW`, Einpflegen von Notizen und Nachträgen, Vorbereitung des Prüfberichts.                         |
| **Rechtsanwalt / Partner (Anwaltsnotariat)** | Selektiver Zugriff: Nur Einsicht in Akten, bei denen kein Mandatskonflikt vorliegt.                                                                         |
| **Kanzlei-Administrator**                    | Technischer Zugriff: Nutzerverwaltung, API-Schlüssel-Konfiguration (ZDR), Schnittstellenanbindung – **kein** Einblick in Mandantenakten ohne Audit-Eintrag. |

---

## 7. Ökosystem, Fachverfahren & Rechtsgebiets-Expansion

### 7.1 Fachverfahren- & Notarnetz-Integration

Der NotarPartner-Prototyp darf im Produktivbetrieb kein isoliertes Datensilo sein, sondern muss sich nahtlos in die bestehende Kanzlei-IT einfügen:

1. **XJustiz / XNP Standard-Export:**
   - Export der validierten Stammdaten (Beteiligte, Liegenschaften, Belastungen) im offiziellen **XJustiz-Standard (XML/JSON)**.
   - Direkter Import in marktführende Notariatsfachverfahren: **TriNotar**, **NoRA Advanced**, **Notar 4.0**, **RA-MICRO**.
2. **EGVP / Notarnetz-Konnexität:**
   - Vorbereitung für die sichere Übertragung über das Elektronische Gerichts- und Verwaltungspostfach (EGVP) und die Bundesnotarkammer-Infrastruktur.

### 7.2 Erweiterung auf weitere notarielle Rechtsgebiete

Über die discriminated Union `CaseType` und die dynamische Cockpit-Registry werden weitere Urkundentypen abgewickelt:

1. **Gesellschaftsrecht (`GMBH_GRUENDUNG`, Handelsregister):**
   - _Pflichtfelder:_ Gesellschafterliste, Stammkapital & Geschäftsanteile, Geschäftsführung & Vertretungsmacht, Satzung / Musterprotokoll, Gründungsvollmachten.
2. **Erbrecht & Nachlass (`ERBSCHEIN_TESTAMENT`):**
   - _Pflichtfelder:_ Erblasser & Sterbedatum, gesetzliche/gewillkürte Erbfolge, Erbenquoten, letztwillige Verfügungen, Pflichtteilsverzichtserklärungen.
3. **Familienrecht (`EHEVERTRAG_SCHIED`):**
   - _Pflichtfelder:_ Güterstand (Gütertrennung / Modifizierte Zugewinngemeinschaft), Unterhaltsvereinbarungen, Versorgungsausgleich.

---

## 8. Priorisierter Umsetzungs- und Phasenplan (Value & Dependency Driven)

Statt einer starren Nummerierung folgt die Umsetzung einem logischen **3-Stufen-Modell**: erst maximale Fachqualität & Sofort-Nutzen für Kanzleien, dann asynchrone Skalierung für Großakten, abschließend Enterprise-Kanzlei-Compliance vor dem breiten Rollout.

```mermaid
graph TD
    subgraph PhaseA["Phase A: Fachlicher Kernnutzen & Basis-Qualität (Immediate Value)"]
        A1["Playwright E2E Basis-Schutz (Smoke Workflow)"]
        A2["RAG-Auditor Stufe 2 (Lokale Prüfregeln & Paragraphen)"]
    end

    subgraph PhaseB["Phase B: Asynchrone Skalierung & Kostensenkung (Scale & Speed)"]
        B1["PostgreSQL Job-Queue (PENDING / PROCESSING / COMPLETED)"]
        B2["Hybrider Layout-Classifier (Text-PDF vs. Vision)"]
        B3["Server-Sent Events (SSE Live-Status im Cockpit)"]
        B4["Provider-Adapter (Bedrock / Azure / Local vLLM)"]
    end

    subgraph PhaseC["Phase C: Enterprise Compliance & Ökosystem (Rollout Ready)"]
        C1["Postgres Revisionssicherer Audit-Trail (§ 17 BeurkG)"]
        C2["PostgreSQL RLS Kanzlei-Isolation (§ 203 StGB)"]
        C3["Erweitertes RAG: Kanzlei-Wissensbasis & DNotI (pgvector + BM25)"]
        C4["KI-Mandantenkorrespondenz & Post-Beurkundung"]
        C5["XJustiz / XNP Schnittstellen für TriNotar & NoRA"]
    end

    PhaseA --> PhaseB --> PhaseC
```

### Übersicht der Phasen & Umsetzungsstatus

| Phase       | Fokus                              | Hauptziel                                                    | Kern-Ergebnisse & Status                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :---------- | :--------------------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase A** | **Fachlicher Kernnutzen**          | Sofortiger Mehrwert für Notare & Fehlerschutz                | • [x] **A.1 Basisschutz des UI-Flows via Playwright**<br>• [x] **A.2 RAG-Prüfregeln (JIT-Retrieval in Stufe 2)**<br>• [ ] **A.4 Agentic Eval Suite & Real-World Testkorpus**<br>• [ ] **A.5 Promptfoo Evaluation Dashboard**<br>_(A.3 `.docx`-Engine ins Backlog ausgelagert)_                                                                                                                                                                                  |
| **Phase B** | **Skalierung & Resilienz**         | Stabilität bei Aktenbänden (50–200 Seiten) & Kostenkontrolle | • [x] **B.1 PostgreSQL Job-Queue (`dossier_jobs` mit PENDING/PROCESSING/COMPLETED/FAILED)**<br>• [x] **B.2 Dual-Stream Ingestion (Unicode-Text für Ziffernintegrität + Vision-Fusion)**<br>• [x] **B.3 SSE-Streaming von Teilfortschritten ins Cockpit**<br>• [x] **B.4 Entkoppelter Worker-Daemon & Zombie-Sweeper**<br>• [ ] B.5 Multi-LLM Provider-Adapter<br>• [ ] **B.8 Serverless-Native Ingestion & Stufe-1-Overhaul (Vercel AI SDK, diff-match-patch)** |
| **Phase C** | **Enterprise & Kanzlei-Ökosystem** | Rechtliche Abnahme & Kanzlei-IT-Integration                  | • [x] **C.1 Append-Only Audit-Trail & Beweissicherung (§ 17 ff. BeurkG)**<br>• [x] **C.2 PostgreSQL RLS Mandantentrennung & Migration-Management (§ 203 StGB)**<br>• [x] **C.3 Erweitertes Kanzlei- & DNotI-RAG (pgvector + BM25 Hybrid)**<br>• [ ] C.4 KI-Mandantenkorrespondenz & Post-Beurkundung<br>• [ ] C.5 XJustiz-Export für TriNotar / NoRA / RA-MICRO                                                                                                 |

### Detaillierter Fortschrittstracker (Phase A)

- [x] **Architektur-Fundament & Guardrails:**
  - [x] Separation of Policy and Mechanism (Materielle Rechtsregeln in `src/lib/knowledge/`, technischer Mechanismus in `src/lib/dossier/`)
  - [x] Dependency-Cruiser Invarianten (`domain-must-not-depend-on-ui`, `hooks-must-not-depend-on-ui`)
  - [x] ESLint AST Invariante gegen ungemergte Template-Strings in `className`
  - [x] Typsichere Dictionaries statt Magic Strings (`CASE_TYPES`, `FIELD_STATUS`, `CASE_STATUS`, `STATUS_LABELS_DE`)
- [x] **A.2 RAG-Auditor (JIT Rule Retrieval):**
  - [x] Typisierte Regel-Registry (`rules-registry.ts`) für GEG, BeurkG, HGB, GBO, BGB, BauGB
  - [x] Deterministischer JIT-Selektor (`rule-selector.ts`) nach Merkmalen aus Stufe 1
  - [x] Pipeline-Injektion in Stufe 2 Prompt (`pipeline.ts`)
  - [x] Unit-Test Suite mit 100 % Abdeckung (`rule-selector.test.ts`)
- [x] **A.1 Playwright E2E Basis-Schutz:**
  - [x] Smoke-Test Workflow (Dokument-Upload $\rightarrow$ Stepper $\rightarrow$ FieldCockpit-Tabelle $\rightarrow$ Status-Override $\rightarrow$ Export) in `e2e/smoke-workflow.spec.ts`
  - [x] Synthetische Urkunden-Fixtures in `e2e/fixtures/test-files.ts`
  - [x] Playwright-Konfiguration mit WebServer-Integration & Chromium Browser (`playwright.config.ts`, `npm run test:e2e`)
- [ ] **A.3 Word-Urkunden-Engine (`.docx`):**
  - _Ausgelagert ins Backlog / siehe [ARCHITECTURE_ROADMAP_ADDITIONS.md](./ARCHITECTURE_ROADMAP_ADDITIONS.md)_
- [ ] **A.4 Agentic Workflow Evaluation & Enterprise Benchmark Suite:**
  - [x] **A.4.1 Baseline-Scorer & Runner (Fundament):**
    - [x] Synthetisches Golden Dataset mit 5 Text-Referenzakten (`src/test/eval/golden-dataset.ts`)
    - [x] Exakter Scorer mit Latenz-Perzentilen (P50, P90, P95, P99), Provenance-Quote & Guardrail-Hits (`src/test/eval/scorer.ts`, `scorer.test.ts`)
    - [x] Automatisierter Runner mit 0,00 € Offline-Replay & Live-Modus (`scripts/eval-pipeline.ts`, `npm run eval`, `npm run eval:live`)
    - [x] Token-Verbrauchs-Tracking in beiden Pipeline-Stufen und Gemini 3.8 Flash Kostenrechner
  - [ ] **A.4.2 Enterprise Real-World Testkorpus (Dreckeffekte & Bildträger):**
    - [ ] Bilddateien / Scans mit realistischen Störungen (unscharfe Personalausweiskopien, schiefe Scans, niedriger Kontrast)
    - [ ] Handschriftliche Randvermerke und Notar-Notizen auf Urkundenseiten
    - [ ] Defekte / unvollständige Dokumente (fehlende Seiten, unleserliche Stempel/Siegel)
    - [ ] Verifikation der Nachforderungs-Logik: Erzwingt das System bei unleserlichen Belegen korrekt `NEEDS_REVIEW` + `inquiries`?
  - [ ] **A.4.3 Multimodal- & OCR-Stresstest:**
    - [ ] Benchmark der Dual-Stream Ingestion unter Last gegen problematische PDFs & Bildanhänge
- [ ] **A.5 Promptfoo Evaluation Matrix & Web-Dashboard:**
  - [ ] `promptfoo` CLI & Test-Runner als Dev-Dependency einbinden (`npm i -D promptfoo`)
  - [ ] Deklarative Konfiguration (`promptfooconfig.yaml`) für Multi-Modell-Vergleiche (Gemini 3.8 Flash vs. Claude 3.5 Sonnet vs. GPT-4o)
  - [ ] Integration der Notar-Scorer (`src/test/eval/scorer.ts`) als typisierte Custom-Assertions in Promptfoo
  - [ ] Lokales Web-Dashboard (`npx promptfoo view`) zum visuellen Vergleich von Prompt-Iterationen und Regressionserkennung
  - [ ] CI/CD Quality-Gate: Automatischer Abbruch bei Genauigkeitsabfall unter 95 % oder P95-Latenzspitzen > 45s

### Detaillierter Fortschrittstracker (Phase B: Asynchrone Skalierung)

- [x] **B.1 PostgreSQL Job-Queue (`dossier_jobs`):**
  - [x] Zod-Schema & TypeScript-Typen für Job-Lebenszyklus (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) und Zwischen-Stages (`src/types/jobs.ts`, `src/types/jobs.test.ts`)
  - [x] Bounded In-Memory- & Supabase-Job-Repository mit Concurrency-Claim & TTL-Pruning (`job-repository.ts`, `job-repository.test.ts`)
  - [x] API-Adapter: `POST /api/analyze` unterstützt asynchrone Annahme via `?async=true` (`202 Accepted` & `jobId`), `GET /api/jobs/[id]`, `GET /api/jobs` & Retry via `POST /api/jobs` (`jobs-route.test.ts`, `jobs-list-route.test.ts`)
  - [x] Worker-Verarbeitungslogik mit Concurrency-Limiter (max. 2 parallele LLM-Jobs gegen 429) & State-Updates (`job-worker.ts`, `job-worker.test.ts`)
  - [x] UI-Integration in `DocumentTable` & Cockpit (Live-Kachel für Hintergrundprüfungen, dynamischer Progress-Balken, A11y, 1-Click Retry bei Fehlern)
- [x] **B.2 Dual-Stream Ingestion Pipeline (Zeichengenauigkeit & Vision):**
  - [x] Introspektion & Klassifikation auf Byte-Ebene (`pdf-stream-classifier.ts`) in Text, Scan oder Hybrid
  - [x] Verlustfreie Extraktion des Unicode-Textlayers (`pdf-text-extractor.ts`)
  - [x] Dual-Stream Payload-Assembler in `pipeline.ts` (Textlayer für Ziffern/Beträge + Vision-Bilder für Siegel/Handschriften)
  - [x] TDD-Unit-Tests für Klassifikation, Text-Integrität und Edge Cases (`pdf-stream-classifier.test.ts`, `pdf-text-extractor.test.ts`)
- [x] **B.3 SSE-Streaming von Teilfortschritten ins Cockpit**
- [x] **B.4 Entkoppelter Worker-Daemon & Zombie-Sweeper:**
  - [x] Eigenständiger Node.js-Worker-Runner mit Graceful Shutdown (`SIGTERM`/`SIGINT`)
  - [x] Periodischer Orphan-Recovery-Sweeper (Reaktivierung verwaister `PROCESSING`-Jobs nach Lease-Timeout)
- [x] **B.5 Serverlose Event-Orchestrierung via Supabase Database Webhooks (Code & DB-Trigger):**
  - [x] Shared-Secret Authentifizierung & Zod-Webhook-Schema (`SupabaseJobWebhookPayloadSchema`)
  - [x] Thin I/O Route Handler `POST /api/jobs/process-webhook` mit 100% TDD-Abdeckung
  - [x] PostgreSQL Realtime-Trigger Migration (`20260921203000_dossier_jobs_webhook_trigger.sql`) via Supabase MCP live scharfgeschaltet
  - [x] Bereinigung des Legacy-Polling-Workers (`run-worker.ts`)
- [ ] **B.6 Post-Deployment Webhook-Aktivierung im Supabase Dashboard:**
  - [ ] Applikation auf Vercel / Hetzner deployen und finale Produktions-Domain erfassen
  - [ ] `SUPABASE_WEBHOOK_SECRET="8f502e1289c87f03a0168939134332a4ffb7aaf92649f35aca1426536ef3e36c"` im Hosting-Environment hinterlegen
  - [ ] Webhook `dossier-jobs-processor` unter Supabase Dashboard **Database > Webhooks** auf `https://<domain>/api/jobs/process-webhook` mit Header `x-webhook-secret` aktivieren
- [ ] **B.7 Multi-LLM Provider-Adapter**
- [ ] **B.8 Serverless-Native Ingestion & Stufe-1-Overhaul (Vercel AI SDK, diff-match-patch):**
  - [ ] **B.8.1 Vercel AI SDK Core Refactoring (Reasoning-First & Flache Sub-Schemas):**
    - [ ] Ablösung handgeschriebener JSON-Bereinigung (`cleanAndParseJson`) und fehleranfälliger Reflection-Turns
    - [ ] **Schutz vor Thinking Degradation & Datenverlust:** Verzicht auf ein einzelnes gigantisches 500-Zeilen-Monolith-Schema. Implementierung des **„Reasoning-First“-Patterns** (Freies juristisches Denken & Analyse im `analysisAndReasoning`-Feld VOR der Bindung an Typen/Enums)
    - [ ] Verwendung von **modularen, flachen Zod-Sub-Schemas** pro Dokumenttyp (z. B. `GrundbuchExtractionSchema`, `EnergieausweisSchema`) statt globalem Monster-Schema
    - [ ] Standardisierung von Multi-Step Tool-Aufrufen für deterministische Zwischenprüfungen
  - [ ] **B.8.2 Deterministisches Zitat-Grounding via `diff-match-patch` (§ 17 BeurkG Provenance):**
    - [ ] Integration der Google `diff-match-patch` Library (schlankes 10-KB TypeScript-Paket) für bit- und zeichengenaue Fundstellen-Verifikation von `source.snippet` auf der angegebenen PDF-Seite
    - [ ] Automatisches Bereinigen von Zeilenumbrüchen/Schnittstellen; Flaggen als `NEEDS_REVIEW` bei nicht auffindbaren Zitaten (Anti-Halluzination)
  - [ ] **B.8.3 Native Dual-Stream Vision-Fusion & Gemini Context Caching:**
    - [ ] 100 % Serverless-Kompatibilität auf Vercel + Supabase (Verzicht auf schwere Python/PyTorch-Container wie Docling)
    - [ ] Verlustfreier Unicode-Textlayer (`unpdf`) für digitale Textseiten (0 ms Kaltstart, 0 € Serverkosten) kombiniert mit selektiver **Gemini 3.8 Flash Vision** für komplexe Tabellen (Grundbuch, Mietlisten) und Siegel/Handschriften
    - [ ] **Gemini Ephemeral Context Caching:** Zwischenspeichern des Dokumenten-Kontexts bei Akten > 32k Tokens $\rightarrow$ **90 % Kostenersparnis** bei Reconciler-Schritten und Nachreichungen; TTFT sinkt auf < 2s
  - [ ] **B.8.4 Triage-gestütztes Dokumenten-Routing & Page-Windowing:**
    - [ ] **Anti-„Lost in the Middle“:** Aufteilung umfangreicher Akten (50–150 Seiten) in logische Dokumenten-Slices oder 10–15-Seiten-Fenster, um 100 % Recall-Genauigkeit auch in der Dokumentenmitte zu garantieren
    - [ ] Gezielte Extraktion domänenspezifischer Pflichtfelder pro Dokumenttyp via spezialisierter Sub-Prompts
    - [ ] Deterministische Map-Reduce Zusammenführung vor Stufe 2
  - [ ] **B.8.5 Pre-Flight Resolution & Contrast Enhancement (Vision-Härtung):**
    - [ ] Automatischer Kontrast- und DPI-Check vor dem Senden an multimodale Modelle (Erkennung verwaschener historischer Grundbuch-Scans oder kontrastarmer Kopien)
    - [ ] Leichtgewichtige Bildoptimierung (Kontrastspreizung / Grayscale-Thresholding) in TypeScript, um Ziffernfehler bei Flurstücken (`108/4` vs. `108/1`) zuverlässig zu verhindern

### Detaillierter Fortschrittstracker (Phase C: Enterprise Compliance & Ökosystem)

- [x] **C.1 Append-Only Audit-Trail & Beweissicherung (§ 17 ff. BeurkG):**
  - [x] Revisionssichere Event-Tabelle (`audit_logs`) mit SHA-256 Hash-Chaining (§ 17 ff. BeurkG)
  - [x] Protokollierung aller Feld-Overrides inkl. Begründungszwang (`StatusOverrideReasonModal`)
  - [x] `IAuditRepository` (Bounded In-Memory & Supabase) mit automatischer Integritätsverifikation
  - [x] Revisionssicherer Prüfbericht-Export inkl. Kettensignatur & Hash-Fingerprint in `ExportActions`
  - _(ZDR-Cloud-Verträge ins Backlog ausgelagert, siehe [ARCHITECTURE_ROADMAP_ADDITIONS.md](./ARCHITECTURE_ROADMAP_ADDITIONS.md))_
- [x] **C.2 PostgreSQL RLS Mandantentrennung & Migration-Management (§ 203 StGB):**
  - [x] Mandanten-Isolation auf Datenbankebene via Row-Level Security (`supabase/migrations/20260915000000_multi_tenancy_rls.sql`)
  - [x] Zod-Schemas & typisierte Notar-Rollen (`NOTAR`, `NOTARASSESSOR`, `SACHBEARBEITER`, `ANWALTSNOTAR_RA`, `ADMIN`) in `src/types/organization.ts`
  - [x] Kanzlei-Isolation in Repositories (In-Memory & Supabase für `audit_logs`, `dossier_jobs` und `documents`)
  - [x] API-Header- und Body-Unterstützung (`x-organization-id`) mit 100 % Unit- und Isolationstest-Abdeckung
  - [x] Deklaratives Migrationsmanagement mit B-Tree- & Partial-Indizes
  - _(Zugehörige UI: Login, Teamverwaltung & RBAC-Guards in [ARCHITECTURE_ROADMAP_ADDITIONS.md §11](./ARCHITECTURE_ROADMAP_ADDITIONS.md#11-kanzlei-authentifizierung-rollen-ui--session-management-auth--rbac-frontend) hinterlegt)_
- [x] **C.3 Erweitertes Kanzlei- & DNotI-RAG (pgvector + BM25 Hybrid):**
  - [x] `pgvector`-Schema in Supabase für DNotI-Gutachten & Leitsatzentscheidungen (`supabase/migrations/20260916093000_kanzlei_knowledge_pgvector.sql`)
  - [x] Hybrid-Search (BM25 für Paragraphen/Normen + Embeddings für Klauselsemantik via `src/lib/knowledge/hybrid-search.ts`)
  - [x] Amtsgericht-Präzedenzdatenbank zur Vermeidung lokaler Zwischenverfügungen (`seed-knowledge.ts`)
  - [x] Kanzlei-interne Klausel- und Vorlagensammlung mit RLS-Mandantenschutz (`SupabaseKnowledgeRepository`)
  - [x] Pipeline-Injektion in Stufe 2 des Notary Auditors (`pipeline.ts` mit Fallback-Resilienz)
  - _(Zugehörige UI: Wissensbasis & RAG-Inspektor in [ARCHITECTURE_ROADMAP_ADDITIONS.md §12](./ARCHITECTURE_ROADMAP_ADDITIONS.md#12-kanzlei-wissensbasis--rag-inspektor-ui-begleit-ui-für-c3) hinterlegt)_
- [ ] **C.4 KI-Mandantenkorrespondenz & Post-Beurkundung:**
  - [ ] Determinismus-geprüfte Anschreiben- & Nachforderungsgenerierung
  - [ ] Fristen- und Wiedervorlagen-Extraktion für den Urkundenvollzug
- [ ] **C.5 XJustiz / XNP Schnittstellen:**
  - [ ] Schema-valider XML-Export (XJustiz 3.4.1+) für Fachverfahren (TriNotar, NoRA, Notar 4.0, RA-MICRO)
- [ ] **C.6 Enterprise Styling Grundattribute & Design Tokens:**
  - _(Detaillierte Spezifikation und Aufgabenplan in [ARCHITECTURE_ROADMAP_ADDITIONS.md §16](./ARCHITECTURE_ROADMAP_ADDITIONS.md#16-enterprise-styling-grundattribute--design-tokens-benchmark-linear-clerk--supabase) hinterlegt)_
