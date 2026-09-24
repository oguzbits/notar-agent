# Reducto-Inspirierte Document-Intelligence-Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) oder superpowers:executing-plans zur taskweisen Umsetzung.

**Goal:** Etablierung einer industriestandard-konformen Dokumentenextraktion und semantischen Integrität in `notar-agent`. Übernahme der Reducto-Muster (Block-Decomposition, normalisierte Bounding Boxes, layout-treue Tabellen, visuelle Zitat-Provenance) gestützt auf bewährte Standard-Bibliotheken (`unpdf`/Mozilla PDF.js, Vercel AI SDK, Zod).

**Industry Reference Baseline:**

1. **Reducto / Google Document AI / AWS Textract:** Normalisiertes Bounding-Box-Schema `[0, 1]` (`left`, `top`, `width`, `height`, `page`) und Block-Typisierung (`TITLE`, `HEADER`, `PARAGRAPH`, `TABLE`, `ANNOTATION`).
2. **Mozilla PDF.js (`unpdf` Engine):** Nativer Einsatz von `TextContent`-Transformationsmatrizen, Zeilenclustern und Font-Metadaten statt naiver String-Splits.
3. **Vercel AI SDK (`ai` + Zod `generateObject`):** Multimodales VLM-Fallback für komplexe Tabellenstrukturen und Scan-Ausschnitte ohne externe proprietäre Cloud-Lockins.

**Architecture:**

1. **SSOT Contracts (`src/types/document.ts` & `src/types/dossier.ts`):**
   - Kanonische `as const`-Dictionaries und Zod-Schemas für `BoundingBox`, `ParsedBlock` und Zitat-Referenzen.
2. **Layout-Preserving Extraction (`src/lib/files/pdf-text-extractor.ts`):**
   - Mozilla PDF.js Text-Transformationen analysieren; mehrspaltige Tabellen in standardisiertes Markdown überführen.
3. **Multimodal VLM-Table Parsing (`src/lib/files/table-extractor.ts`):**
   - Bei Hybrid-/Scan-PDFs strukturierte Extraktion tabellarischer Daten via AI SDK `generateObject` mit Zod-Validierung.
4. **Prompt & Context Grounding (`src/lib/ai/payload-assembler.ts`):**
   - Bereitstellung des strukturierten Markdown-Kontexts inkl. Block-IDs zur Vermeidung von Halluzinationen bei Ziffern und Beträgen.

**Tech Stack:** TypeScript (strict), `unpdf` (Mozilla PDF.js), `ai` (Vercel AI SDK), `zod`, Vitest, React 19.

## Global Constraints

- Strict Typing: `strict: true`, zero `any`, zero unvalidated `as`, strikte Zod-Schema-Inferenz (`z.infer`).
- Zero Hardcoded Domain Knowledge: Juristische Regeln verbleiben in der Datenbank; reine Extraktionsmechanismen in `src/lib/files/`.
- Zero Magic Strings: Alle Block-Typen und Dokumentstatus aus zentralen `as const`-Dictionaries ableiten.
- Datenschutz & § 203 StGB: Keine externen ungeschützten Third-Party-Parser; lokale Mozilla PDF.js Engine und vertraglich gesicherte LLM-Instanzen via AI SDK.
- Test-First (TDD): Jeder Task beginnt mit einem fehlschlagenden Test.
- Quality Gates: `npm run check` und `npm test` müssen mit 0 Fehlern durchlaufen.

---

### Task 1: Type Contracts & Schemas für Document Blocks (`ParsedBlock` & `BoundingBox`)

**Files:**

- Modify: `src/types/document.ts`
- Test: `src/types/document.test.ts`

**Interfaces:**

- Produces:
  - `DOCUMENT_BLOCK_TYPES = { TITLE: 'TITLE', HEADER: 'HEADER', PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE', ANNOTATION: 'ANNOTATION' } as const`
  - `BoundingBoxSchema`: Normalisierte Koordinaten `[0, 1]` (`page >= 1`, `left >= 0 && left <= 1`, `top >= 0 && top <= 1`, `width >= 0 && width <= 1`, `height >= 0 && height <= 1`).
  - `ParsedBlockSchema`: `{ id: string, type: DocumentBlockType, content: string, bbox: BoundingBox, rawText?: string }`
  - `DocumentExtractionResultSchema`: `{ rawText: string, blocks: ParsedBlock[], pageCount: number }`

- [ ] **Step 1: Fehlschlagenden Type- & Zod-Validierungstest schreiben**
      In `src/types/document.test.ts`:

```typescript
it('validiert ein valides BoundingBoxSchema im Bereich [0, 1]', () => {
  const validBox = { page: 1, left: 0.1, top: 0.2, width: 0.8, height: 0.3 };
  expect(BoundingBoxSchema.safeParse(validBox).success).toBe(true);
});
it('weist ungültige BoundingBox-Koordinaten ab', () => {
  const invalidBox = { page: 0, left: -0.1, top: 1.5, width: 0.8, height: 0.3 };
  expect(BoundingBoxSchema.safeParse(invalidBox).success).toBe(false);
});
```

- [ ] **Step 2: Test ausführen und Fehler verifizieren**
      Run: `npx vitest run src/types/document.test.ts`
      Expected: FAIL (Schemas nicht definiert).

- [ ] **Step 3: Schemas in `src/types/document.ts` implementieren**
      Definition der `as const`-Objekte, Schemas und abgeleiteten Typen.

- [ ] **Step 4: Test ausführen und verifizieren**
      Run: `npx vitest run src/types/document.test.ts`
      Expected: PASS.

---

### Task 2: Layout-Preserving PDF-Extraktion via Mozilla PDF.js (`pdf-text-extractor.ts`)

**Files:**

- Modify: `src/lib/files/pdf-text-extractor.ts`
- Test: `src/lib/files/pdf-text-extractor.test.ts`

**Interfaces:**

- Consumes: Mozilla PDF.js `getDocumentProxy`, `textContent.items` mit Transformationsmatrizen.
- Produces:
  - `extractPdfStructuredDocument(buffer: Buffer | Uint8Array): Promise<DocumentExtractionResult>`
  - Tabellarische Layouts mit mehreren X-Spaltenpositionen werden in formatiertes Markdown (`| Spalte 1 | Spalte 2 |`) umgewandelt.
  - Generierung der normalisierten Bounding-Boxes relativ zu den Viewport-Abmessungen.

- [ ] **Step 1: Testfall für Tabellenrekonstruktion aus PDF-Koordinaten schreiben**
      In `src/lib/files/pdf-text-extractor.test.ts`: Testfall mit Mock-Items (Zellen mit gleicher Y-Koordinate, aber unterschiedlichen X-Werten wie bei einem Grundbuchauszug) verifiziert, dass ein `ParsedBlock` mit Typ `TABLE` und Markdown-Tabellenstruktur erzeugt wird.

- [ ] **Step 2: Test ausführen und Fehlschlag prüfen**
      Run: `npx vitest run src/lib/files/pdf-text-extractor.test.ts`

- [ ] **Step 3: Implementierung in `pdf-text-extractor.ts`**
  1. `page.getViewport({ scale: 1.0 })` auslesen für exakte Breiten/Höhen-Normalisierung.
  2. TextItems nach Y-Position in Zeilen gruppieren (Line-Clustering mit Schwellenwert).
  3. Mehrspaltige Zeilenmuster detektieren und in Markdown-Tabellenzeilen übersetzen.
  4. Rückgabe von `DocumentExtractionResult` mit strukturierten `ParsedBlock`s.

- [ ] **Step 4: Tests ausführen**
      Run: `npx vitest run src/lib/files/pdf-text-extractor.test.ts`
      Expected: PASS.

---

### Task 3: Multimodaler Fallback für komplexe Tabellen & Scans via Vercel AI SDK

**Files:**

- Create: `src/lib/files/table-extractor.ts`
- Test: `src/lib/files/table-extractor.test.ts`

**Interfaces:**

- Consumes: `ai` (Vercel AI SDK), `@ai-sdk/google` bzw. `@ai-sdk/anthropic`, Bildausschnitt / Scan.
- Produces:
  - `extractTableFromImage(imageBuffer: Buffer, mimeType: string): Promise<string>` (strukturiertes Markdown via `generateObject`).

- [ ] **Step 1: Testfall mit Mock-LLM schreiben**
      In `src/lib/files/table-extractor.test.ts`: Testet die Extraktion via `generateObject` mit Zod-Schema unter Verwendung von Test-Fixtures.

- [ ] **Step 2: Test ausführen und Fehlschlag prüfen**
      Run: `npx vitest run src/lib/files/table-extractor.test.ts`

- [ ] **Step 3: `extractTableFromImage` implementieren**
      Verbindung zu `ai`-SDK mit klarem Prompt für Notariats-Tabellen (z. B. Lasten/Beschränkungen in Abt. II, Grundschulden in Abt. III).

- [ ] **Step 4: Tests ausführen**
      Run: `npx vitest run src/lib/files/table-extractor.test.ts`
      Expected: PASS.

---

### Task 4: Integration strukturierter Blöcke in den `payload-assembler.ts`

**Files:**

- Modify: `src/lib/ai/payload-assembler.ts`
- Test: `src/lib/ai/payload-assembler.test.ts`

**Interfaces:**

- Consumes: `DocumentExtractionResult` aus Task 2.
- Produces: Kontext-Prompt, der Markdown-Tabellen intakt hält und Block-IDs für Zitate annotiert.

- [ ] **Step 1: Test für strukturierte Block-Übergabe schreiben**
      In `src/lib/ai/payload-assembler.test.ts`: Verifizieren, dass formatierte Tabellenblöcke unfragmentiert an das Dossier-Prompt übergeben werden.

- [ ] **Step 2: Test ausführen und Fehlschlag prüfen**
      Run: `npx vitest run src/lib/ai/payload-assembler.test.ts`

- [ ] **Step 3: `payload-assembler.ts` erweitern**
      Unterstützung von `DocumentExtractionResult` neben reinem Fließtext.

- [ ] **Step 4: Tests ausführen**
      Run: `npx vitest run src/lib/ai/payload-assembler.test.ts`
      Expected: PASS.

---

### Task 5: Zitat-Grounding & Bounding Boxes in `src/types/dossier.ts`

**Files:**

- Modify: `src/types/dossier.ts`
- Test: `src/types/dossier.test.ts`

**Interfaces:**

- Consumes: `BoundingBoxSchema` aus `src/types/document.ts`.
- Produces: Erweiterung von `SourceCitationSchema` um optionales `bbox?: BoundingBox`.

- [ ] **Step 1: Test für `SourceCitationSchema` mit `bbox` schreiben**
      In `src/types/dossier.test.ts`: Prüfen, dass Zitate neben `documentId`, `page` und `textSnippet` auch optional die Bounding Box annehmen.

- [ ] **Step 2: Test ausführen und Fehlschlag prüfen**
      Run: `npx vitest run src/types/dossier.test.ts`

- [ ] **Step 3: `SourceCitationSchema` aktualisieren**
      `bbox: BoundingBoxSchema.optional()` integrieren.

- [ ] **Step 4: Tests ausführen**
      Run: `npx vitest run src/types/dossier.test.ts`
      Expected: PASS.

---

### Task 6: End-to-End Quality Gate & Architecture Compliance

**Files:**

- Alle modifizierten Dateien

- [ ] **Step 1: Vollständige Test-Suite ausführen**
      Run: `npm test`
      Expected: 100% Tests grün.

- [ ] **Step 2: Quality Gates & AST/Architektur-Prüfungen ausführen**
      Run: `npm run check` (`type-check`, `lint`, `depcruise`, `knip`, `audit:magic-strings`, `audit:duplication`).
      Expected: 0 Fehler.
