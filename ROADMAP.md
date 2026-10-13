# Notar Agent — Roadmap & Aktiver Arbeitsplan

> **Zweck:** Zentrale, schlanke Arbeitsplanung und Phasenstatus für Entwickler und KI-Agenten.  
> **Architektur-Spezifikationen:** Tiefgehendes System- und Schichtenwissen liegt entkoppelt unter [docs/architecture/](./docs/architecture/) und [docs/overview.md](./docs/overview.md).  
> **Historischer Nachweis:** Alle fertiggestellten Meilensteine sind archiviert in [CHANGELOG.md](./CHANGELOG.md).  
> **Feature-Backlog:** Nachgelagerte Zusatzmodule liegen in [BACKLOG.md](./BACKLOG.md).

---

## 1. Phasen-Übersicht & Reifegrad

| Phase       | Fokus                  | Status                 | Kernziel                                           | Nächste Meilensteine                                               |
| :---------- | :--------------------- | :--------------------- | :------------------------------------------------- | :----------------------------------------------------------------- |
| **Phase A** | Fachlicher Kernnutzen  | 🟢 **Fundament live**  | Verlässlicher 2-Stufen-Auditor & Ground-Truth-Eval | Skalierbares Benchmark-System (100+ Fälle & RAGAS)                 |
| **Phase B** | Skalierung & Resilienz | 🟡 **In Umsetzung**    | Serverlose Ingestion & Laststabilität              | Serverless Ingestion Overhaul (B.8) & k6 Lasttest-Suite (B.9)      |
| **Phase C** | Enterprise Ökosystem   | 🟡 **Compliance live** | Berufsgeheimnis (§ 203 StGB) & Fachverfahren       | Post-Beurkundung (C.4), XJustiz-Export (C.5) & Design Tokens (C.6) |

---

## 2. Architektur-Referenzen (SSOT)

Detaillierte technische Spezifikationen, Diagramme und Invarianten:

- 🏛️ **Gesamtsystem & Schichten:** [docs/overview.md](./docs/overview.md)
- ⚖️ **5-Stufen Enterprise Legal Processing:** [docs/architecture/enterprise-legal-processing.md](./docs/architecture/enterprise-legal-processing.md)
- 📄 **Dual-Stream Ingestion (Unicode + Vision):** [docs/architecture/dual-stream-ingestion.md](./docs/architecture/dual-stream-ingestion.md)
- ⚡ **Asynchrone Job-Orchestrierung (`after()`):** [docs/architecture/job-orchestration.md](./docs/architecture/job-orchestration.md)
- 🔒 **Mandantenfähigkeit & RLS (§ 203 StGB):** [docs/architecture/multi-tenancy-compliance.md](./docs/architecture/multi-tenancy-compliance.md)
- 🧪 **Eval- & Benchmark-Framework:** [docs/architecture/evaluation-framework.md](./docs/architecture/evaluation-framework.md)

---

## 3. Aktiver Arbeitsplan (Offene Aufgaben)

### Phase A: Evaluation & Skalierung

- [ ] **A.4.3 Skalierbares Benchmark-System (100+ synthetische Fälle & RAGAS):**
  - _(Detaillierter 4-Phasen-Architekturplan in [docs/architecture/evaluation-framework.md](./docs/architecture/evaluation-framework.md) hinterlegt)_
  - [ ] Parametrisierter Akten-Generator (`scripts/eval/generate-dataset.ts`) zur Erzeugung von 50+ synthetischen Fällen mit Ground Truth
  - [ ] Visuelle Perturbation-Matrix via `sharp` (Blur- und Rotations-Stufen zur Härtung gegen Scan-Artefakte)
  - [ ] RAGAS-Metriken im Scorer (`context_recall`, `context_precision`, `faithfulness`)
  - [ ] Parallele Batch-Evaluation (`-j 3` bis `-j 5`) für schnelle CI-Qualitätsprüfungen

### Phase B: Serverless Ingestion & Lasttests

- [ ] **B.8 Serverless-Native Ingestion & Stufe-1-Overhaul (Vercel AI SDK, Dual-Stream):**
  - [ ] **B.8.1 Robuste 2-Stufen-Architektur & Flache Sub-Schemas:**
    - [ ] Bewahrung der erprobten 2-Stufen-Architektur (Stufe 1 Extraktion $\rightarrow$ deterministischer Fact-Checker $\rightarrow$ Stufe 2 Auditor & Reconciler)
    - [ ] **Schutz vor Thinking Degradation & Datenverlust:** Keine künstlichen Tool-Loops; Beibehaltung des bewährten „Reasoning-First“-Ansatzes vor der Zod-Normalisierung
    - [ ] Modulare, flache Validierungsschemas pro Dokumenttyp (z. B. Grundbuch, Energieausweis, Mietliste)
  - [ ] **B.8.3 Native Dual-Stream Vision-Fusion (Serverless & Zero Cold Start):**
    - [ ] 100 % Serverless-Kompatibilität auf Vercel + Supabase (Verzicht auf schwere Python/PyTorch-Container wie Docling)
    - [ ] Verlustfreier nativer Node.js Stream-Layer für digitale Textseiten (0 ms Kaltstart, 0 € Serverkosten) kombiniert mit Gemini Vision (`gemini-3.1-flash-lite`) für komplexe Tabellen, Siegel und Handschriften
  - [ ] **B.8.4 Triage-gestütztes Dokumenten-Routing bei Großakten:**
    - [ ] Standardakten (bis 80 Seiten) verbleiben im vollen globalen Kontext, um alle Querverweise (z. B. Vollmachten in Anlagen) zu sichern
    - [ ] Selektives Dokumenten-Windowing ausschließlich als Schutzmechanismus für extrem umfangreiche Archivbände (> 150 Seiten)
  - [ ] **B.8.5 Akten- & Namespace-basierte Isolation (Archiv-Tiering & Cold-Data-Schutz):**
    - [ ] _(Architektur-Baseline: Legora & turbopuffer – Vermeidung von RAM-Thrashing und monolithischen HNSW-Clustern)_
    - [ ] Dossier-basierte Namespaces: Trennung aktiver Bearbeitungskontexte von ruhenden Mandantenarchiven (Zero Cache-Pollution in PostgreSQL pgvector)
    - [ ] Lifecycle & Storage-Tiering: Automatischer Export ruhender Akten-Vektoren und Chunks in verschlüsselten Supabase Object Storage nach Beurkundungsvollzug (§ 17 BeurkG)
  - [ ] **B.8.6 Deterministische Hybrid-Suche (BM25 + pgvector mit RRF):**
    - [ ] Lexikalische Volltext- und Trigram-Suche (`tsvector` / `pg_trgm`) für exakte Ziffernfolgen (Flurstücke, Gemarkungen, Aktenzeichen, Kaufpreise)
    - [ ] Semantische Vektorsuche (`pgvector`) für juristische Klauselbedeutungen
    - [ ] Reciprocal Rank Fusion (RRF) Scorer zur deterministischen Zusammenführung vor Modell-Injektion
- [ ] **B.9 k6 API- & Supabase-Lasttest-Suite:**
  - _(Detaillierte Spezifikation und Aufgabenplan in [BACKLOG.md §18](./BACKLOG.md#18-k6-api--supabase-lasttest-suite-benchmark-grafana-k6-enterprise-load-testing) hinterlegt)_
- [ ] **B.10 Enterprise Ingestion, Supabase Object Storage & System-Härtung:**
  - [x] **B.10.1 Supabase Object Storage (`dossier-files`) & Zero-Base64-Postgres:**
    - Privater, RLS-gesicherter Bucket `dossier-files` (Mandantentrennung nach `organization_id`)
    - Direkter Browser-to-Storage Upload (Überwindung des 4,5-MB-Vercel-Limits für Großakten > 50 Seiten)
    - Ersatz von Base64-Strings in `dossier_jobs.payload` durch schlanke Storage-Pfade (`storagePath`)
  - [x] **B.10.2 Beseitigung von Sicherheits- & Spoofing-Schwachstellen (§ 203 StGB):**
    - Beseitigung der hardcodierten `DEFAULT_ORG_ID` und Header-Overrides in `api/team/route.ts` und `api/team/[id]/route.ts`
    - Striktes Least-Privilege für unauthentifizierte Fallback-Profile im `AuthProvider`
  - [x] **B.10.3 Performance & Network I/O Härtung:**
    - [x] Lazy-Loading von `useTeam()` (wird erst beim Öffnen des `TeamSettingsModal` geladen, entlastet Root-Layout)
    - [x] Schlanke Tabellen-Projektion für Dokumente (Metadaten-Only für die Tabelle, Detail-Dossier on demand)
  - [ ] **B.10.4 2-Stufen-Job-Chunking für Serverless-Resilienz (60s-Budget-Schutz):**
    - Sequentielle Abwicklung von Stufe 1 (Extraktion) und Stufe 2 (Auditor) über `dossier_jobs.stage` mit jeweils eigenem 60s-Laufzeitbudget
  - [ ] **B.10.5 Code-Komplexitäts-Entflechtung & Deep Modules:**
    - Zerlegung von `verifiable-fact-checker.ts` (Komplexität 51) in modulare Seams
    - Verlagerung juristischer Prüfnormen aus `domain-guardrails.ts` in die deklarative `knowledge_documents`-Tabelle gem. `AGENTS.md`

### Phase C: Enterprise Compliance & Ökosystem

- [ ] **C.4 KI-Mandantenkorrespondenz & Post-Beurkundung:**
  - [ ] Determinismus-geprüfte Anschreiben- & Nachforderungsgenerierung
  - [ ] Fristen- und Wiedervorlagen-Extraktion für den Urkundenvollzug
- [ ] **C.5 XJustiz / XNP Schnittstellen:**
  - [ ] Schema-valider XML-Export (XJustiz 3.4.1+) für Fachverfahren (TriNotar, NoRA, Notar 4.0, RA-MICRO)
- [ ] **C.6 Enterprise Styling Grundattribute & Design Tokens:**
  - _(Detaillierte Spezifikation und Aufgabenplan in [BACKLOG.md §15](./BACKLOG.md#15-enterprise-styling-grundattribute--design-tokens-benchmark-linear-clerk--supabase) hinterlegt)_
