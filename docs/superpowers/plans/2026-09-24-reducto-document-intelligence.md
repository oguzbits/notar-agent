# Notariats-Präzision & Eval-Benchmark Architecture Plan (Option A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` oder `superpowers:executing-plans` zur schrittweisen Umsetzung.

**Goal:** Konsolidierung und Ausbau der Notariats-Präzision in Step 1 & 2 sowie Schärfung des Evaluierungs-Frameworks. Nach der erfolgreichen Implementierung der Layout-Strukturierung (`layout-structure-parser.ts`) und des Faktenprüfers (`verifiable-fact-checker.ts`) liegt der Fokus auf **Substanz, Auswertungsgenauigkeit und Ausbau des Benchmark-Systems**, statt vorzeitig ungenutzte Pixel-Bounding-Boxes anzuhäufen.

**Industry Reference Baseline:**

1. **Ragas / LangSmith Evaluation Standards:** Getrennte Messung von Context Precision, Context Recall, Faithfulness (Zitatexaktheit) und Answer Correctness.
2. **Deterministic-First AI Pipelines:** Hard constraints (Mathematik, Fristen, Zitat-Existenz) filtern Vorhersagen, bevor teure LLM-Reasoning-Schritte gestartet werden.
3. **Canonical Notary Domain Grounding:** Striktes Auslesen und Verifizieren von Grundbuchbelastungen (Abt. II/III) und kaufmännischen Zahlungsplänen.

**Status der Vorgängerpläne:**

- `2026-09-25-step1-document-intelligence.md`: **100 % abgeschlossen** (Modell-Governance, Layout-Parsing, Faktenprüfung).
- `2026-09-24-reducto-document-intelligence.md`: **Abgelöst durch diesen Plan**. Geometrische Bounding-Boxes (`bbox [0, 1]`) und isolierter `table-extractor.ts` sind gem. Invariante 1 (YAGNI & Anti-Redundanz) bis zur Einführung des PDF-Viewers im Frontend zurückgestellt.

---

## Die 4 Säulen für Notariats-Präzision & Evals

### Säule 1: Ausbau der Verifiable Fact Checks (Step 1 Konsistenz)

- **Problem:** `verifiable-fact-checker.ts` prüft aktuell Zitate und einfache Summen/Raten.
- **Ziel:** Tiefere Absicherung komplexer notarieller Beträge:
  - Kaufpreis vs. Summe der Einzelraten/Treuhandkonten.
  - Abgleich von Grundbuch-Flächen (Flurstücke m² im Bestandsverzeichnis vs. Gesamtsumme).
  - Plausibilisierung von Personendaten (z. B. Geburtsdatum vs. Volljährigkeit, Güterstand).

### Säule 2: Vertiefte Grundbuch- & Belastungsextraktion (Abt. II / III)

- **Problem:** Grundbuchauszüge mit mehreren Lasten (Dienstbarkeiten, Wohnungsrechte, Grundschulden) erfordern saubere Trennung von Rang, Betrag, Gläubiger und Löschungsvormerkungen.
- **Ziel:** Der `layout-structure-parser.ts` gruppiert Abteilungen bereits vor. Nun wird die Extraktion im Prompt & Post-Processing für mehrteilige Belastungen gestärkt, damit der Auditor Löschungsauflagen exakt zuordnet.

### Säule 3: RAG- & Trajectory-Scorer Anbindung (`src/lib/evals/`)

- **Problem:** Die Layer-2/3-Judges (`deterministic-judge.ts`, `jev-judge.ts`, `trajectory.ts`) existieren als Types und Basis-Klassen, sind aber noch nicht vollständig im CLI-Runner (`npm run eval:run` / Benchmark-Suite) verdrahtet.
- **Ziel:** Vollständige Kopplung: Bei jedem Eval-Lauf wird gemessen:
  - Wurden die richtigen Wissensnormen (§§ BeurkG, GEG, BGB) ausgewählt (`trajectory.ts`)?
  - Wurde der Status jedes Pflichtfelds exakt getroffen (`deterministic-judge.ts`)?

### Säule 4: Synthetischer Benchmark-Generator (Skalierung von 8 auf 50+ Akten)

- **Ziel:** Umsetzung von Phase 1 aus `docs/eval-scaling-plan.md` (`scripts/eval/generate-dataset.ts`):
  - Parametrisierte Notarakten auf Knopfdruck zur statistischen Absicherung der Pipeline.
