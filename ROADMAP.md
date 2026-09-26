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
- ⚡ **Asynchrone Job-Orchestrierung & Webhooks:** [docs/architecture/job-orchestration.md](./docs/architecture/job-orchestration.md)
- 🔒 **Mandantenfähigkeit & RLS (§ 203 StGB):** [docs/architecture/multi-tenancy-compliance.md](./docs/architecture/multi-tenancy-compliance.md)
- 🧪 **Eval- & Benchmark-Framework:** [docs/architecture/evaluation-framework.md](./docs/architecture/evaluation-framework.md)

---

## 3. Aktiver Arbeitsplan (Offene Aufgaben)

### Phase A: Evaluation & Skalierung

- [ ] **A.4.3 Skalierbares Benchmark-System (100+ synthetische Fälle & RAGAS):**
  - _(Detaillierter 4-Phasen-Architekturplan in [docs/architecture/evaluation-framework.md](./docs/architecture/evaluation-framework.md) hinterlegt)_
  - [ ] Parametrisierter Akten-Generator (`scripts/eval/generate-dataset.ts`) zur Erzeugung von 50+ synthetischen Fällen mit Ground Truth
  - [ ] Visuelle Perturbation-Matrix via `sharp` (Blur-, Rotations- und Scan-Stufen zur Härtung gegen Bildartefakte)
  - [ ] RAGAS-Metriken im Scorer (`context_recall`, `context_precision`, `faithfulness`)
  - [ ] Gemini & Anthropic Prompt Caching zur 75 % Kostenreduktion bei Batch-Evaluationen

### Phase B: Serverless Ingestion & Lasttests

- [ ] **B.8 Serverless-Native Ingestion & Stufe-1-Overhaul (Vercel AI SDK, Dual-Stream):**
  - [ ] **B.8.1 Vercel AI SDK Core Refactoring (Reasoning-First & Flache Sub-Schemas):**
    - [ ] Ablösung handgeschriebener JSON-Bereinigung (`cleanAndParseJson`) und fehleranfälliger Reflection-Turns
    - [ ] **Schutz vor Thinking Degradation & Datenverlust:** Verzicht auf ein einzelnes gigantisches 500-Zeilen-Monolith-Schema. Implementierung des **„Reasoning-First“-Patterns** (Freies juristisches Denken & Analyse im `analysisAndReasoning`-Feld VOR der Bindung an Typen/Enums)
    - [ ] Verwendung von **modularen, flachen Zod-Sub-Schemas** pro Dokumenttyp (z. B. `GrundbuchExtractionSchema`, `EnergieausweisSchema`) statt globalem Monster-Schema
    - [ ] Standardisierung von Multi-Step Tool-Aufrufen für deterministische Zwischenprüfungen
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
- [ ] **B.9 k6 API- & Supabase-Lasttest-Suite:**
  - _(Detaillierte Spezifikation und Aufgabenplan in [BACKLOG.md §18](./BACKLOG.md#18-k6-api--supabase-lasttest-suite-benchmark-grafana-k6-enterprise-load-testing) hinterlegt)_

### Phase C: Enterprise Compliance & Ökosystem

- [ ] **C.4 KI-Mandantenkorrespondenz & Post-Beurkundung:**
  - [ ] Determinismus-geprüfte Anschreiben- & Nachforderungsgenerierung
  - [ ] Fristen- und Wiedervorlagen-Extraktion für den Urkundenvollzug
- [ ] **C.5 XJustiz / XNP Schnittstellen:**
  - [ ] Schema-valider XML-Export (XJustiz 3.4.1+) für Fachverfahren (TriNotar, NoRA, Notar 4.0, RA-MICRO)
- [ ] **C.6 Enterprise Styling Grundattribute & Design Tokens:**
  - _(Detaillierte Spezifikation und Aufgabenplan in [BACKLOG.md §15](./BACKLOG.md#15-enterprise-styling-grundattribute--design-tokens-benchmark-linear-clerk--supabase) hinterlegt)_
