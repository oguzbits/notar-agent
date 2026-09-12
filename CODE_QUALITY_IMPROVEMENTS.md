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

## 4. [ERLEDIGT] Mangelnde fachliche Skalierbarkeit: Case-Strategy-Pattern & Dynamisches Datenmodell

- **Status:** Erledigt (Stufe 2 Discriminated Union & GmbH-Schemata implementiert)
- **Umgesetzte Maßnahmen:**
  - `src/types/dossier.ts`:
    - Definition von `GmbhFieldsSchema` mit typisierten Fachdaten (`firma`, `gesellschafter`, `geschaeftsfuehrer`, `stammkapital`, `unternehmensgegenstand`).
    - Definition von `GmbhDossierSchema` und `GmbhDossier`.
    - Umstellung von `DossierSchema` auf `z.discriminatedUnion('caseType', [ImmobilienDossierSchema, GmbhDossierSchema])`.
    - Bereitstellung typsicherer Type-Guards (`isImmobilienDossier`, `isGmbhDossier`).
    - Beseitigung ungetypter Fluchtluken (`z.record(z.string(), z.unknown())`).
  - `src/types/dossier.test.ts`: Vollständige Validierungstests für Schema-Parsing, Typ-Diskriminierung und Type-Guards.

---

## 5. [ERLEDIGT] Überladung von Hilfsfunktionen in `dossier-helpers.ts`

- **Status:** Erledigt
- **Umgesetzte Maßnahmen:**
  - **Modularisierung in `src/lib/dossier/`:**
    - `src/lib/dossier/types.ts`: Typdefinitionen für `SubSourceItem`, `FieldObservation`, `CaseTypeCoreConfig`.
    - `src/lib/dossier/constants.ts`: Statische Feld-Registries (`IMMOBILIEN_FIELD_METADATA`, `CASE_TYPE_METADATA_REGISTRY`, `CASE_TYPE_CORE_FIELDS`, `STATUS_LABELS_DE`).
    - `src/lib/dossier/ui-mapper.ts`: Reine UI- und Text-Mapping-Funktionen (`cleanSourceFileName`, `parseSourceLocations`, `extractFieldObservations`, `extractAllFieldRows`, `generatePruefberichtText`).
    - `src/lib/dossier/readiness.ts`: Reine juristische Reifegradprüfungen (`isDossierEntwurfsreif`, `getDossierReadinessStage`).
    - `src/lib/dossier/normalizer.ts`: Robuste Datenbereinigung und juristische Fach-Guardrails (§ 35 GBO, § 12 HGB).
    - `src/lib/dossier/index.ts`: Zentraler Barrel-Export.
  - `src/lib/dossier-helpers.ts`: Vollständig als abwärtskompatible Fassade belassen, sodass alle bestehenden Importe ohne Refactoring-Risiko stabil bleiben.
  - Dedizierte Unit-Tests für jedes Einzelmodul (`constants.test.ts`, `ui-mapper.test.ts`, `readiness.test.ts`).

---

# Phase III: Backend & Service-Architektur (Pipeline & I/O)

## 6. [ERLEDIGT] Monolithisches God-File & Vermischung von Streaming- und Domänenlogik in `route.ts`

- **Status:** Erledigt
- **Umgesetzte Maßnahmen:**
  - `src/lib/ai/parsers/clean-json.ts`: Robuste Bereinigung von Markdown-Codeblöcken (`json ... `) und fehlertolerantes JSON-Parsing inkl. vollständiger Testsuite (`clean-json.test.ts`).
  - `src/lib/sse/create-sse-stream.ts`: Kapselung von nativer SSE-Stream-Erzeugung, Standard-Headern und standardisiertem Event-Encoding (`sendEvent`, `close`, `error`) mit isolierter Testsuite (`create-sse-stream.test.ts`).
  - `src/lib/ai/ai-provider.ts`: Saubere Factory zur flexiblen Initialisierung von Google Gemini oder Anthropic Claude Modellen samt Provider-Optionen (z. B. Ephemeral Prompt Caching).
  - `src/lib/ai/pipeline.ts`: Reiner Pipeline-Orchestrator `runAnalysisPipeline`, der Ingestion-, Reconciler- und Schema-Normalisierungsstufen mit Dependency Injection kapselt.
  - `src/app/api/analyze/route.ts`: Schrumpfung des Controllers von >650 Zeilen auf einen schlanken HTTP-Adapter (<130 Zeilen).

---

## 7. [ERLEDIGT] Kopplung von Dateivorbereitung und UI in `UploadZone.tsx`

- **Status:** Erledigt
- **Umgesetzte Maßnahmen:**
  - `src/lib/files/file-preparer.ts`: Reine Servicefunktionen für Dateigrößen-Validierung (`MAX_FILE_SIZE_BYTES = 32 MB`), FileReader-Text/Base64-Verarbeitung und Canvas-Bildskalierung auf 1600px.
  - `src/lib/files/file-preparer.test.ts`: Unit-Tests für Größenprüfung und Validierungslogik.
  - `src/components/UploadZone.tsx`: Befreit von asynchroner Canvas- und FileReader-Logik; agiert nun als reine Präsentations- und Drop-Komponente.

---

## 8. [ERLEDIGT] Globaler Shared State & Memory-Leak-Risiko in `server.ts`

- **Status:** Erledigt
- **Umgesetzte Maßnahmen:**
  - `src/lib/supabase/repository.ts`: Formale Definition von `IDossierRepository` mit Trennung in `InMemoryDossierRepository` und `SupabaseDossierRepository`.
  - **Bounded Memory Guard:** `InMemoryDossierRepository` ist mit einer festen Obergrenze (standardmäßig 25 Einträge, FIFO-Verdrängung) versehen, wodurch unbeschränktes Anwachsen im Arbeitsspeicher (`heap out of memory`) ausgeschlossen ist.
  - `src/lib/supabase/repository.test.ts`: Vollständige Unit-Tests für CRUD-Operationen und Verdrängungs-Obergrenze.
  - `src/lib/supabase/server.ts`: Schlanke Fassade mit Singleton-Factory `getDossierRepository()`; 100%ige Abwärtskompatibilität für alle bestehenden Routen und Aufrufer.

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
