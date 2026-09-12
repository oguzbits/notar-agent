# Code-Qualitäts- & Refactoring-Katalog (Clean Code & Architecture)

## Executive Summary: Die 4 Kern-Schwachstellen der aktuellen Codebase

Obwohl das System für den aktuellen Scope (multidokumentarische Immobilienkaufverträge) fachlich und optisch exzellent funktioniert, weist die Codebase **vier fundamentale Architektur-Schwachstellen** auf, die einen echten Produktivbetrieb und die Weiterentwicklung behindern:

1. **Mangelnde Frontend-Resilienz, A11y & Styling-Fragmentierung (Fundament):**
   - Es existieren weder Next.js App Router Error Boundaries (`error.tsx`) noch komponenten-isolierte Boundaries (Gefahr des vollständigen White Screen of Death). Das Styling ist über 40 Dateien hinweg in willkürliche Pixel-Größen (`text-[10.5px]`) und hardcodierte Hex-Farben (`bg-[#A2E771]`) zersplittert. Interaktive Elemente verletzen grundlegende Barrierefreiheitsstandards (WCAG 2.1 / BITV 2.0).
2. **Fachlicher Monolith & fehlende Domänen-Entkopplung (Core Domain):**
   - Obwohl `CaseType` bereits `GMBH_GRUENDUNG` vorsieht, sind Prompts, Schemata, Entwurfsreife-Prüfungen und Tabellen fest auf die 10 Immobilien-Pflichtfelder verdrahtet. Notariats-Prüfregeln und UI-Formatierungshelfer sind in `dossier-helpers.ts` (>560 Zeilen) untrennbar verknüpft, statt generische Vorgangseigenschaften und vertragsspezifische Payloads sauber zu trennen.
3. **Monolithischer Glue-Code & ungetestete Pipeline (Backend & I/O):**
   - Die zentrale Analyse-API `route.ts` (>620 Zeilen) vereint HTTP-Handling, Low-Level SSE-Byte-Streaming, multimodale Dateikonvertierung, serielle Anthropic/Claude-Aufrufe und DB-Persistierung in einem unteilbaren Block. Unbeschränkte globale In-Memory-Speicher (`globalThis`) erzeugen Memory-Leaks.
4. **State-Explosion & UI-Duplikation (Frontend-Architektur):**
   - Der Page-Controller (`page.tsx`) verwaltet über 10 `useState`-Hooks via Prop-Drilling. Über 1.300 Zeilen UI-Code schreiben dieselben Tabellenfelder statisch aus, wodurch mehr als 350 Zeilen JSX zwischen Kachel- und Detailansicht 1:1 dupliziert sind. Zudem finden sich imperative DOM-Manipulationen im React-Code.

---

# Phase I: Systemische Resilienz, Barrierefreiheit & Design-Fundament

## 1. [ERLEDIGT] Fehlende Error Boundaries & mangelnde Crash-Resilienz im Frontend

- **Status:** Erledigt
- **Umgesetzte Maßnahmen:**
  - `src/app/error.tsx`: Globaler Next.js App Router Fehler-Fallback mit Reset-Möglichkeit.
  - `src/app/global-error.tsx`: Root-Level Fallback für kritische Ausfälle der Root-Layout-Ebene.
  - `src/components/ui/ErrorBoundary.tsx`: Wiederverwendbare, komponenten-isolierte React-Boundary mit individuellem Fallback und Alert-Role.
  - `src/components/views/DossierDetailView.tsx`: Cockpit-Tabelle und Aktenbestand isoliert mit `ErrorBoundary` gekapselt.
  - `src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx`: Ausklappbare `FieldDetailContent`-Bereiche isoliert gekapselt.
  - `src/components/ui/ErrorBoundary.test.tsx`: Vollständige Unit-Test-Abdeckung.

---

## 2. [ERLEDIGT] Fragmentiertes Styling & fehlende Design-Tokens (Typography & Color Debt)

- **Status:** Erledigt (Fundament & Kernkomponenten migriert)
- **Umgesetzte Maßnahmen:**
  - `src/app/globals.css`: Semantische Typografie-Tokens (`--text-2xs: 0.6875rem`, `--text-3xs: 0.625rem`) in `@theme` für kompakte Notariats-Tabellen definiert.
  - Bereinigung hardcodierter Farbcodes in Kern-UI:
    - `src/components/ui/StatusBadge.tsx`: Umstellung von `[#B9ED94]`, `[#E7F9DA]`, `[#284E0D]` auf semantische Klassen `border-documenso-400`, `bg-documenso-200`, `text-documenso-950`.
    - `src/components/ui/Button.tsx`: Umstellung auf `bg-documenso-500`, `text-documenso-950`, `hover:bg-documenso-600`, `focus-visible:ring-documenso-900`.
    - `src/components/ExportActions.tsx`: Bereinigung von hardcodierten Hex-Grüns auf `bg-documenso-500`, `hover:bg-documenso-600`.
  - Verbleibende fachfeldspezifische View-Klassen werden im Rahmen der Config-Driven Table Engine (Phase IV, Punkt 12) vollends modularisiert.

---

## 3. [ERLEDIGT] Barrierefreiheit & Tastaturbedienbarkeit (WCAG 2.1 / BITV 2.0 Compliance)

- **Status:** Erledigt
- **Umgesetzte Maßnahmen:**
  - `src/components/FieldCockpit/SourceAuditDrawer.tsx`: Ausstattung des Toggle-Buttons mit `aria-expanded`, `aria-controls="source-audit-drawer-content"` und tastaturfokussierbarem sichtbarem Ring (`focus-visible:ring-2`).
  - `src/components/DocumentDetectionList.tsx`: Vollständige Tastatur-Interaktivität (`tabIndex={0}`, `role="button"`, `aria-expanded`, `aria-controls`, `onKeyDown` für Enter/Leertaste) auf Dokument- und Notiz-Zeilen; aussagekräftige `aria-label`s auf allen Einklapp-/Ausklapp-Schaltflächen.
  - `src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx`: Semantische ARIA-Attribute (`aria-expanded`, `aria-controls`, `role="region"`) und Keyboard-Navigation auf den Tabellenzeilen sichergestellt.

---

# Phase II: Core Domain & Datenmodell (Single Source of Truth)

## 4. Mangelnde fachliche Skalierbarkeit: Case-Strategy-Pattern & Dynamisches Datenmodell

- **Betroffene Dateien:**
  - `src/types/dossier.ts` (`CaseTypeSchema = z.enum(['IMMOBILIENKAUF', 'GMBH_GRUENDUNG'])`, `ImmobilienFieldsSchema`, starre Union in `DossierSchema`)
  - `src/lib/ai/prompts.ts` (`IMMOBILIEN_EXTRACTION_AGENT_PROMPT`, `NOTARY_AUDITOR_RECONCILER_PROMPT`)
  - `src/app/api/analyze/route.ts` (Hartverdrahtet: `IMMOBILIEN_EXTRACTION_AGENT_PROMPT`)
  - `src/lib/dossier-helpers.ts` (`CASE_TYPE_CORE_FIELDS`, feste Immobilien-Readiness-Prüfung)
- **Status Quo:**
  Das System ist vollständig auf Immobilienkaufverträge festverdrahtet. Bei Auswahl von `GMBH_GRUENDUNG` sendet `route.ts` dennoch Immobilien-Prompts an Anthropic. Das Datenmodell erzwingt starre Keys (`verkaeufer`, `grundbuch`), wodurch GmbH-Felder (Stammkapital, Gesellschafter, Geschäftsführer) weder typisiert noch normalisiert werden können.
- **Konkretes Problem:**
  - Um ein neues Rechtsgebiet (z. B. GmbH-Gründung, Erbvertrag) hinzuzufügen, müssen 6 zentrale Dateien quer durch Frontend, Backend, Prompts und Schemata modifiziert werden.
  - Das Open-Closed-Principle (OCP) wird verletzt: Bestehender Code muss geändert werden, statt ihn modular zu erweitern.
- **Refactoring-Maßnahme (Evolutionärer Pfad nach YAGNI & Rule-of-Three):**
  - **Stufe 1 (Aktuell: 1 aktiver CaseType):**
    Strikte Trennung von generischen Vorgangseigenschaften (`caseTitle`, `detectedDocuments`, `inquiries`, `overallStatus`) und der vertragsspezifischen Payload (`ImmobilienFields`). Die 10 Pflichtfelder behalten ihre 100% statische Typsicherheit (kein generisches `Record<string, unknown>`).
  - **Stufe 2 (Evolution auf 2 CaseTypes – z. B. GmbH-Gründung):**
    Einführung einer **TypeScript Discriminated Union** (`type Dossier = ImmobilienDossier | GmbhDossier` mit `caseType: 'IMMOBILIENKAUF' | 'GMBH_GRUENDUNG'`). Sämtliche Prompts und Prüfungen verzweigen deterministisch via typgeprüftem `switch (caseType)` mit Exhaustiveness-Check (`assertNever`).
  - **Stufe 3 (Evolutionärer Trigger: Ab 3+ CaseTypes):**
    > **Agent-Direktive / Kriterium für Architektur-Upgrade:**
    > Sobald ein dritter konkreter Vorgangstyp (z. B. `ERBVERTRAG`) hinzukommt, greift die _Rule of Three_ ([AGENTS.md:L8](file:///Users/oguz/Desktop/Dev/notar-partner-prototyp/AGENTS.md#L8)). Erst hier schlägt der Agent aktiv den Übergang zum **Strategy/Registry-Pattern** (`CaseStrategy<T>`, `src/core/cases/`) vor, um Switch-Verzweigungen zu ablösen.

---

## 5. Überladung von Hilfsfunktionen in `dossier-helpers.ts`

- **Betroffene Datei:** `src/lib/dossier-helpers.ts` (565 Zeilen)
- **Status Quo:**
  Die Datei fungiert als Sammelbecken für vier unterschiedliche Schichten:
  1. **Fachliche Registry & Metadaten:** `IMMOBILIEN_FIELD_METADATA`, Spalten-Reihenfolgen, Pflichtfeld-Listen.
  2. **Daten-Sanitizing & Normalisierung:** `normalizeDossier`, URL-/Quellenbereinigung, String-Trimming, Fallback-Generierung.
  3. **Juristische Notariats-Regeln:** `isDossierEntwurfsreif`, Fristenberechnung nach § 17 Abs. 2a BeurkG, Status-Aggregation.
  4. **UI-View-Model Transformation:** `extractAllFieldRows`, `formatSourceCitation`, Aggregation von Teilnachweisen (`SubSourceItem[]`).
- **Konkretes Problem:**
  - Backend-API-Routen und React-Client-Komponenten importieren dieselbe Datei.
  - UI-Formatierungsänderungen berühren rechtlich bindende Notariats-Prüfregeln.
- **Refactoring-Maßnahme:**
  - **Aufteilung in fokussierte Module:**
    - `src/lib/dossier/normalizer.ts`: Reine Datenbereinigung und Schemakonformität (Zod).
    - `src/lib/dossier/readiness.ts`: Reine Geschäfts- und Notariatslogik (Entwurfsreife, Fristen).
    - `src/lib/dossier/ui-mapper.ts`: Transformation von `Dossier` in Tabellenzeilen (`FieldObservation`).
    - `src/lib/dossier/constants.ts`: Statische Metadaten und Typ-Registries.

---

# Phase III: Backend & Service-Architektur (Pipeline & I/O)

## 6. Monolithisches God-File & Vermischung von Streaming- und Domänenlogik in `route.ts`

- **Betroffene Datei:** `src/app/api/analyze/route.ts` (622 Zeilen)
- **Status Quo:**
  Auf über 620 Zeilen vereint die Datei sechs orthogonale Verantwortlichkeiten:
  1. HTTP-Request-Validierung & Header-Konfiguration
  2. Native SSE-Stream-Erzeugung (`new ReadableStream`, `TextEncoder`, Ping-Intervalle)
  3. Multimodale Payload-Transformation (Base64-Puffer vs. Plaintext)
  4. Sequenzielle LLM-Aufrufe (`generateText` für Stage 1 & Stage 2) inkl. Prompt-Templating
  5. Fehlertolerantes JSON-Parsing per Regex-Stripping und Error-Catching
  6. Domänen-Reconciliation (Delta-Modus, `normalizeDossier`) und Datenbank-Persistierung
- **Konkretes Problem:**
  - **Nahezu untestbar:** In `analyze.test.ts` werden nur zwei Fehler-Codes getestet. Weder der SSE-Stream noch die Stufen der KI-Pipeline können ohne Next.js-Server-Mocks getestet werden.
  - **SRP-Verletzung:** Änderungen am Streaming-Protokoll gefährden die Persistierung oder die Prompt-Verarbeitung.
- **Refactoring-Maßnahme:**
  - **Thin Controller Pattern:** `route.ts` schrumpft auf <50 Zeilen (reiner HTTP-Adapter).
  - **SSE Manager (`src/lib/sse/create-sse-stream.ts`):** Kapselt den Stream-Controller, Heartbeat-Pings und standardisiertes Event-Encoding (`sendEvent(type, payload)`).
  - **Pipeline Orchestrator (`src/lib/ai/pipeline.ts`):** Pure Funktion `runAnalysisPipeline(...)` mit Dependency Injection (Model, Storage, Notifier).
  - **JSON Parser Utility (`src/lib/ai/parsers/clean-json.ts`):** Getestete Hilfsfunktion für Markdown-Codeblock-Bereinigung und resilienten Fallback.

---

## 7. Kopplung von Dateivorbereitung und UI in `UploadZone.tsx`

- **Betroffene Datei:** `src/components/UploadZone.tsx` (436 Zeilen)
- **Status Quo:**
  Die Komponente handhabt Drag & Drop, Render-Listen, Fehlermeldungen sowie das direkte asynchrone Einlesen und Base64-Encoden von `File`-Objekten (`FileReader`, Canvas-Resizing, Text- vs. Binary-Erkennung).
- **Konkretes Problem:**
  - Asynchrone Datei-Leseoperationen blockieren die Komponentenlogik.
  - Validierungsregeln (z. B. maximale Dateigröße 32 MB) sind fest im UI-Event-Handler verdrahtet.
- **Refactoring-Maßnahme:**
  - **File Processing Service (`src/lib/files/file-preparer.ts`):** Reine Utility-Funktion zur Typ-Erkennung, Validierung und Base64-/Blob-Extraktion.
  - `UploadZone` wird zur reinen Präsentations- und Drop-Komponente.

---

## 8. Globaler Shared State & Memory-Leak-Risiko in `server.ts`

- **Betroffene Datei:** `src/lib/supabase/server.ts` (356 Zeilen)
- **Status Quo:**
  Verwendung von unbeschränktem `globalThis.__inMemoryDocuments` direkt neben Supabase-SDK-Aufrufen ohne formales Interface. Neue Dokumente werden unbegrenzt via `unshift` angehängt.
- **Konkretes Problem:**
  - **Memory Leak:** In langlebigen Node- oder Serverless-Instanzen wächst das globale Array unbegrenzt mit großen Dossier-Payloads an (Gefahr von `heap out of memory`).
  - **Mangelnde Testbarkeit:** `persistDossierRecord` und `updateDossierRecord` enthalten `if-else`-Verzweigungen für Datenbank vs. Memory. Keine Dependency Injection möglich.
- **Refactoring-Maßnahme:**
  - **Repository Pattern & Bounded LRU/FIFO-Puffer:**
    ```typescript
    export interface IDossierRepository {
      findById(id: string): Promise<DocumentRecord | null>;
      save(dossier: Dossier): Promise<PersistenceResult>;
      update(id: string, dossier: Dossier): Promise<UpdateResult>;
      list(): Promise<DocumentRecord[]>;
    }
    ```
  - Trennung in `SupabaseDossierRepository` und `InMemoryDossierRepository` (letzteres mit fester Obergrenze, z. B. max. 25 Einträge). Auswahl erfolgt über eine Factory (`getRepository()`).

---

# Phase IV: Frontend-Architektur & UI-Engine

## 9. Streaming-Protokoll-Kopplung im Client-Hook

- **Betroffene Datei:** `src/hooks/useAnalysisWorkflow.ts` (204 Zeilen)
- **Status Quo:**
  Der Hook steuert den React-State (`isAnalyzing`, `activeStep`, `stepDetail`) und implementiert gleichzeitig das Low-Level SSE-Parsing manuell über `reader.read()`, `TextDecoder`, Zeilen-Splitting und String-Slicing (`data:`).
- **Konkretes Problem:**
  - Netzwerk-Transport und UI-State sind fest verdrahtet.
  - Event-Meldungen oder Protokollanpassungen können nicht isoliert per Node/Vitest getestet werden, ohne React-Render-Hooks zu mocken.
- **Refactoring-Maßnahme:**
  - **Stream-Parser auslagern (`src/lib/sse/parse-sse-stream.ts`):** Ein generischer Async-Generator, der `ReadableStream<Uint8Array>` in typisierte Events transformiert (`for await (const event of parseSseStream(response))`).
  - `useAnalysisWorkflow` mappt ausschließlich die konsumierten Events auf den UI-State.

---

## 10. State-Explosion & Prop-Drilling im Page-Controller (`src/app/page.tsx`)

- **Betroffene Datei:** `src/app/page.tsx` (304 Zeilen)
- **Status Quo:**
  `HomeContent` verwaltet über 10 `useState`-Hooks gleichzeitig (`files`, `caseType`, `notes`, `dossier`, `activeDocumentId`, `isAppending`, `appendFiles`, `appendNotes`, `persistenceInfo` etc.) und schleift sie über Props tief in `NewVorgangUploadView` und `DossierDetailView`.
- **Konkretes Problem:**
  - Jede kleine Statusänderung (z. B. Tippen einer Notiz) re-rendert die gesamte Page-Struktur.
  - URL-Sync (`router.push`) und lokale Modalzustände sind eng gekoppelt.
- **Refactoring-Maßnahme (State Hygiene & Zero New Dependencies):**
  - **Push State Down:** Lokale UI-Zustände (z. B. Inline-Notizeditor, Zeilen-Akkordeon) werden direkt in die Blattkomponenten verlagert ([AGENTS.md:L16](file:///Users/oguz/Desktop/Dev/notar-partner-prototyp/AGENTS.md#L16)), statt den Page-Controller zu re-rendern.
  - **Nativer Page-Reducer (`useVorgangSession`):** Bündelung der verbleibenden Seiten-Zustände in einem typsicheren, nativen React `useReducer` oder Context (keine externen State-Bibliotheken wie Zustand gemäß Dependency Freeze [AGENTS.md:L34](file:///Users/oguz/Desktop/Dev/notar-partner-prototyp/AGENTS.md#L34)).
  - Views erhalten nur noch atomare Dispatch-Aktionen statt unzähliger einzelner `useState`-Setter.

---

## 11. UI-Monolith & Vermischung von State und Layout im Cockpit

- **Betroffene Datei:** `src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx` (496 Zeilen)
- **Status Quo:**
  Die Tabelle verwaltet gleichzeitig Bearbeitungszustände für Notizen, Akkordeon-Aufklappzustände, Inline-Texteditoren mit Klick-Outside-Handling, Status-Override-Dropdowns und das Haupt-Markup.
- **Konkretes Problem:**
  - Jedes Tastendruck-Event im Notizfeld re-rendert die gesamte 10-Zeilen-Tabelle samt aller geöffneten Detailansichten.
  - Hohe kognitive Komplexität beim Lesen der Komponente; UI-Teile sind nicht isoliert testbar.
- **Refactoring-Maßnahme:**
  - **Dumb / Smart Component Separation:**
    - `CockpitTableHeader`: Header, Massen-Aktionen (Alle aufklappen, Filter).
    - `CockpitTableRow`: Gekapselte Zeile mit eigenem Expand- und Edit-State.
    - `StatusOverrideDropdown`: Isolierte Komponente für Status-Änderungen.
    - `InlineNoteEditor`: Isolierte Textbereich-Komponente mit eigenem Submit/Cancel-Flow.

---

## 12. Config-Driven UI-Engine statt 1.300 Zeilen dupliziertem Render-Code

- **Betroffene Dateien:**
  - `src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx` (496 Zeilen)
  - `src/components/FieldCockpit/CockpitGrid.tsx` (496 Zeilen)
  - `src/components/FieldCockpit/FieldDetailContent.tsx` (386 Zeilen)
- **Status Quo:**
  Über 1.300 Zeilen UI-Code schreiben die 10 Felder des Immobilienkaufs statisch aus. `CockpitGrid` und `FieldDetailContent` duplizieren fast 350 Zeilen JSX für dieselben Felder. Zudem sind Zähler und Texte hartcodiert (_„Alle 10 Pflichtfelder belegt“_).
- **Konkretes Problem:**
  - Für eine GmbH-Gründung müsste eine komplett neue Tabelle mit weiteren 500 Zeilen geschrieben werden.
  - Änderungen an einem Feld-Label müssen synchron an mehreren Stellen gepflegt werden (DRY-Verletzung).
- **Refactoring-Maßnahme:**
  - **Dynamische Table Engine (`DynamicFieldCockpitTable.tsx`):**
    Die Tabelle iteriert generisch über die Felder der gewählten Vorgangs-Strategie:
    ```tsx
    <tbody>
      {strategy.fieldMetadata.map((meta) => (
        <CockpitTableRow key={meta.key} meta={meta} field={dossier.fields[meta.key]} />
      ))}
    </tbody>
    ```
  - **Atomare Sub-Renderer (`src/components/FieldCockpit/fields/`):** Wiederverwendbare Komponenten für spezifische Fachdaten (z. B. `GrundbuchDetail.tsx`, `VerkaeuferDetail.tsx`), die sowohl in Kacheln als auch in der Tabelle genutzt werden.

---

## 13. Imperative DOM-Manipulationen & Browser-Memory-Leaks beim Export

- **Betroffene Datei:** `src/components/ExportActions.tsx` (37 Zeilen)
- **Status Quo:**
  Die Export-Logik erzeugt imperativ im Render-Kontext temporäre HTML-Elemente (`document.createElement('a')`), fügt sie per `document.body.appendChild` ein und triggert `downloadAnchor.click()`.
- **Konkretes Problem:**
  - Verletzung von React-Deklarativität und SSR-Sicherheit.
  - In restriktiven Umgebungen (CSP ohne Inline-Data-URIs) schlägt der Export lautlos fehl.
  - Fehlendes Cleanup von Object-URLs bei künftigen Binär-Exporten (PDF/Word).
- **Refactoring-Maßnahme:**
  - **Export Utility Service (`src/lib/export/download-helper.ts`):**
    Getestete, typsichere Hilfsfunktion mit nativer `Blob`-Erzeugung, sauberen `URL.createObjectURL` und deterministischem `revokeObjectURL`-Cleanup.
