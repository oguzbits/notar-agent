# Strategischer Architekturplan: Skalierbares Goldstandard-Evaluation-Framework

## 1. Ausgangslage & Zielsetzung

Aktuell verfügt `notar-agent` über ein Golden Dataset aus **8 handkuratierten Akten** (`fall-01` bis `fall-08`).

- **Vorteil:** Schneller Smoke- & Regressionstest vor Commits / PRs.
- **Defizit:** Keine statistische Signifikanz für Produktionsreife. 1 Ausreißer entspricht sofort 12,5 % Fehlerrate. Edge Cases (z. B. komplexe Erbbaurechte, Zwangsversteigerungsvermerke, variable Bildauflösungen) werden nicht abgedeckt.
- **Ziel:** Skalierung von 8 statischen Akten auf ein **kontinuierliches, synthetisch generierbares Benchmark-System mit 100+ Testpermutationen**, RAG-Metriken und Perturbation-Stresstests nach dem Vorbild führender Document-Intelligence-Systeme (Reducto AI, LangSmith, Anthropic).

---

## 2. Die 4 Säulen des Goldstandard-Eval-Frameworks

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EVALUATION FRAMEWORK                            │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. DATASET-       │ 2. PERTURBATION-  │ 3. METRIKEN- &                 │
│    GENERATOR      │    ENGINE         │    RAG-EVALUATION              │
│ (Synthetische     │ (Qualitäts-       │ (RAGAS Context Precision,      │
│  Notarakten)      │  Stresstest)      │  Field Accuracy, Cost/Latency) │
└─────────┬─────────┴─────────┬─────────┴───────────────┬────────────────┘
          │                   │                         │
          └───────────────────┼─────────────────────────┘
                              ▼
        ┌───────────────────────────────────────────┐
        │  4. PROMPTFOO CI/CD & NIGHTLY RUNNER      │
        │  • Smoke-Run (8 Fälle, < 1 min, PRs)      │
        │  • Matrix-Run (100+ Fälle, Nightly/Audit) │
        └───────────────────────────────────────────┘
```

---

## 3. Die Phasen im Detail

### Phase 1: Parametrisierte Synthetische Benchmark-Engine (`scripts/eval/generate-dataset.ts`)

_Ziel: Erzeugung von beliebig vielen deterministisch validierten Testfällen auf Knopfdruck._

- **Kombinatorischer Seed-Generator:**
  - Zufällige, aber juristisch plausible Namen, Firmen, Grundbuchblätter, Kaufpreise und Notariate.
  - Definition von Testprofilen (`STANDARD_KAUF`, `WEG_TEILUNG`, `ERBFALL_ABWEICHUNG`, `MOPEG_EGBR_MANGEL`, `HANDSCHRIFTLICHE_AENDERUNG`).
- **Ground-Truth-Kopplung:**
  - Die Ground Truth (Erwartungswerte, Status, exakte Zitate) wird **zeitgleich mit der Dokumentenerstellung** generiert. Es gibt keine manuelle Nachpflege.
- **CLI-Befehl:**
  ```bash
  npm run eval:generate -- --count 50 --out src/test/eval/synthetic-dataset.json
  ```

### Phase 2: Visuelle Perturbation-Matrix (Reducto-AI-Benchmark)

_Ziel: Messung der Robustheit gegenüber realen Scan-Mängeln._

- Erweitern von `scripts/fixtures/` um eine standardisierte Bild-Transformations-Pipeline (`sharp`):
  1. **Blur-Stufen:** 0px, 1.0px, 2.5px, 4.0px
  2. **Schieflage / Rotation:** 0°, 2.5°, 7.5°, 15°
  3. **Scan-Artefakte:** JPEG-Kompression, Handyschatten (radialer Verlauf), Knicke
- **Messziel:** Den exakten Kipppunkt ermitteln, ab welchem Grad der Unschärfe das Modell ehrlich `NEEDS_REVIEW` meldet, statt falsche Daten zu halluzinieren.

### Phase 3: RAG- & Retrieval-Evaluation (RAGAS-Standard)

_Ziel: Trennung zwischen Retrieval-Fehlern und LLM-Reasoning-Fehlern._

- Aktuell wird nur das finale Dossier bewertet.
- **Erweiterung des Scorers (`src/test/eval/scorer.ts`) um Retrieval-Metriken:**
  - **Context Recall:** Wurde die einschlägige Norm (z. B. § 21 BeurkG, § 80 GEG) vom Hybrid-Matching aus PostgreSQL abgerufen?
  - **Context Precision:** Welcher Anteil des abgerufenen Kontexts war für den konkreten Fall relevant (Vermeidung von Token-Verschwendung)?
  - **Faithfulness:** Stammen alle generierten Aussagen im Dossier nachweisbar aus den Belegen (Halluzinations-Score)?

### Phase 4: Token- & Kosten-Optimierung für Massen-Evals

- **Prompt Caching:** Bei 100 Testfällen sind die Systemprompts identisch. Mit Prompt Caching sinken die Token-Kosten um bis zu 75 %.
- **Getrennte Ausführungsebenen:**
  - `npm run eval:smoke`: 1-2 Fälle für sofortiges Feedback (< 15s).
  - `npm run eval:case:live <1-8>`: Gezielter Test einzelner Kanzleifälle (< 10s).
  - `npm run eval:matrix:synthetic`: 50+ synthetische Fälle für Release-Freigaben.

---

## 4. Sofort umsetzbare nächste Schritte

1. [x] **Fall 01 Bereinigung:** Entfernung der Stützdatei `Personalausweis_Referenz.png` (Bereits erfolgreich umgesetzt: 100 % PASS mit alleinigem unscharfem Scan).
2. [ ] **Parametrisierter Datensatz-Generator:** Erstellung eines CLI-Skripts `scripts/eval/generate-dataset.ts`, das auf Basis bestehender SVG/PDF-Generatoren 20 neue Testakten synthetisiert.
3. [ ] **Prompt Caching Aktivierung:** Cache-Control Header für `gemini-3.5-flash-lite` und Anthropic in `promptfoo-provider.ts` scharfstellen.
