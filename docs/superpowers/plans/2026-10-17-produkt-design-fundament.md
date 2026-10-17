# Produkt- und Design-Fundament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ivory/Ink-Token-Umbau ohne Markenakzent, dokumentiert in `PRODUCT.md` und `DESIGN.md`, belegt durch Audit vorher/nachher.

**Architecture:** Alle Farben laufen weiter über semantische Tokens in [globals.css](../../../src/app/globals.css). Die Palette `notar-*` entfällt, ihre rund 150 Verwendungen in 27 Dateien werden auf semantische Klassen umgestellt. Zwei Schutztests (Kontrast der Token-Paare, keine verbliebenen `notar-`-Klassen) ersetzen manuelle Sichtprüfung. Keine Feature-Änderung.

**Tech Stack:** Next.js, Tailwind v4 (`@theme` in `globals.css`), `next/font/google`, Vitest, Playwright (`e2e/quality`), axe.

**Spec:** [2026-10-15-produkt-design-fundament-design.md](../specs/2026-10-15-produkt-design-fundament-design.md); Werte aus der [Referenzstudie](../specs/2026-10-15-legal-ai-referenzstudie.md).

## Pre-Flight (AGENTS.md 4A)

- **Scope:** Token-Umbau, Typo-Skala, Serif/Mono, PRODUCT.md, DESIGN.md, Docs-Parität.
- **Referenzbasis:** Harvey (Ivory/Ink, Serif-Titel, kein Markenakzent), Linear (ruhige Dichte), GitHub Org Settings (Statusfarben nur für Zustand). Übernommen werden Prinzipien aus öffentlichen Quellen, nichts aus den Apps (Spec, Referenzquellen).
- **Impact:** `LOCAL_CODE_ONLY`, keine Migration.
- **Nicht enthalten:** Dark Mode (existiert nicht im Code: kein `data-theme` in `src`, keine Dark-Variablen), Beleg-Cockpit, Review-Tabelle, Strg+K, Feature-Änderungen.
- **Erfolg:** `npx vitest run src/app` grün, `npm run check`, `npm test`, `npm run test:quality` (axe, CLS ≤ 0.1; braucht lokale Supabase, sonst offen melden).

## Global Constraints

- Farbwerte exakt aus der Studie: Ivory `#fafaf9`, Grauskala `#f2f1f0` bis `#1f1d1a`, Ink `#0f0e0d`, Status Grün `#16a34a`, Gelb `#eab308`, Rot `#f26161`.
- Kein Markenakzent, kein Limettengrün, kein `notar-*` mehr. Farbe nur für Status und Fokus.
- Komponenten nutzen nur semantische Tokens (`@shadcn/lint`); keine rohen Palettenfarben.
- Typo nach AGENTS.md 3: Fließtext, Eingaben, Labels `text-base`; `text-sm` nur Hilfstext, Zeitstempel, kompakte Tabellenzellen; `text-xs` nur Status-Pills; Überschriften `font-bold tracking-tight`.
- Nutzertexte kanonisch deutsch (`src/lib/dossier/constants.ts`); keine Paragraphen als Slogan oder Badge (AGENTS.md 2.6).
- Docs: nur relative Links, keine absoluten Maschinenpfade, keine Aufgabenlisten in `docs/architecture` und `docs/overview.md`.
- Serifenschrift nur über `next/font/google` einbinden; Verfügbarkeit des gewählten Fonts vor der Wahl gegen die aktuelle Next.js-Doku prüfen (AGENTS.md Invariante 10).

## Review Focus

1. Gelb `#eab308` als Text oder Pill auf Ivory unterschreitet 4,5:1 → Kontrasttest je Token-Paar (Task 3).
2. Tailwind v4 ignoriert unbekannte Klassen lautlos; eine vergessene `bg-notar-500` rendert ohne Fläche → Scan-Test (Task 3).
3. Fokus muss auf allen interaktiven Elementen sichtbar bleiben, wenn `--ring` von Limette auf Ink wechselt → axe und `focus-visible`-Prüfung (Task 5).
4. Schriftwechsel darf kein Layout verschieben (Serif lädt nach) → vorhandener CLS-Test, `display: 'swap'` (Task 4).
5. Deaktivierte oder laufende Buttons (Primär jetzt Ink) müssen als deaktiviert erkennbar bleiben → Prüfung am `Button`-Primitive (Task 3).

---

### Task 1: Design-Audit der Ist-UI

**Files:**

- Create: `docs/design/audit-2026-10.md` (nur Text; Screenshots bleiben außerhalb des Repos)

**Interfaces:**

- Produces: nummerierte Mängelliste je Ansicht (Kontrast, Typo-Skala, Dichte, Zustände, Touch-Ziele) mit Datei und Klasse; Task 3, 4 und 5 arbeiten sie ab, DESIGN.md (Task 2) zitiert sie.

- [ ] **Step 1:** Mit der Demo-Sitzung aus [demo-session.ts](../../../e2e/support/demo-session.ts) Screenshots in der Scratchpad ablegen: `/login`, `/register`, `/`, `/?view=upload` bei 1440 und 390 px, nur hell. Ansichten Fortschritt, Cockpit, Team nur, wenn die Demo-Sitzung sie ohne KI-Lauf erreicht; sonst in der Liste als „nicht erreichbar" führen.
- [ ] **Step 2:** `grep -rn "text-xs\|text-2xs\|text-3xs" src` auswerten: jede Stelle gegen AGENTS.md 3 einordnen (erlaubt: Status-Pill; sonst Mangel).
- [ ] **Step 3:** Basismessung festhalten: `npm run test:quality` (CLS, axe) und Ergebnis in die Liste schreiben.
- [ ] **Step 4:** Commit `docs: Design-Audit der Ist-UI`.

### Task 2: PRODUCT.md und DESIGN.md

**Files:**

- Create: `PRODUCT.md`, `DESIGN.md`

**Interfaces:**

- Consumes: Mängelliste aus Task 1, Studie.
- Produces: Token-Tabelle in DESIGN.md (Name, Light-Wert, Verwendung) als Vorlage für Task 3; die Namen dort sind verbindlich.

- [ ] **Step 1: PRODUCT.md:** Abschnitte Zielnutzer (Notar, Notarfachangestellte, Reviewer), Positionierung („Jede Aussage mit Beleg"), Produktprinzipien (Prüfung durch Notar erforderlich, keine KI-Fachbegriffe in der UI), Abgrenzung (kein Beurkundungssystem, kein Rechtsrat). Deutsch, keine Paragraphen als Slogan.
- [ ] **Step 2: DESIGN.md:** Nordstern; Farbtabelle (Surface/Ink/Grau, Status, Fokus); Typografie (Serif für Akten- und Dokumenttitel, Mono für Aktenzeichen und Flurstücknummern, Sans für den Rest); Radien (4, 6, 8 px); Dichte; Zustandsregeln (Vierer-Quadrant aus AGENTS.md 2.3); Do's and Don'ts. Eigene Entscheidungen kennzeichnen: Fokusring in Ink (Studie schweigt), Statusfarben nur mit Text- oder Icon-Beigabe.
- [ ] **Step 3:** `npm run audit:docs` → Expected: keine Meldung zu den neuen Dateien.
- [ ] **Step 4:** Commit `docs: PRODUCT.md und DESIGN.md`.

### Task 3: Token-Umbau mit Schutztests

**Files:**

- Create: `src/app/globals.test.ts`
- Modify: `src/app/globals.css`, die 27 Dateien mit `notar-` (Liste: `grep -rlE "notar-[0-9]" src`), `src/components/ui/*` bei Bedarf

**Interfaces:**

- Produces: semantische Tokens laut DESIGN.md; zusätzlich `--success`, `--success-foreground`, `--warning-foreground` (heute fehlen Vordergründe für Füllfarben).

- [ ] **Step 1: Test schreiben** in `globals.test.ts` (liest `globals.css` und `src` per `node:fs`), Fälle:
  - `Kontrast der Token-Paare erreicht 4,5:1` für foreground/background, card-foreground/card, muted-foreground/background, muted-foreground/muted, primary-foreground/primary, secondary-foreground/secondary, accent-foreground/accent, destructive-foreground/destructive, success-foreground/success, warning-foreground/warning; Helfer `contrastRatio(hslTriplet: string, hslTriplet: string): number` nur im Test.
  - `globals.css enthält keine notar-Farbtokens und kein Limettengrün` (`--color-notar-`, `#d0f3b7`, `95.08`).
  - `src enthält keine notar-Klassen` (Regex `\b(bg|text|border|ring|from|to|via|fill|stroke|outline|shadow|divide)-notar-\d`).
  - `Fokusring ist Ink`: `--ring` gleich `--foreground`.
- [ ] **Step 2:** `npx vitest run src/app/globals.test.ts` → Expected: FAIL (Limette, notar-Klassen).
- [ ] **Step 3: `globals.css` umbauen:** `:root`-Werte auf Studie (Ivory-Hintergrund, Ink-Text, Grauskala für muted/secondary/accent/border, `--primary` = Ink, `--primary-foreground` = Ivory), `--color-notar-*` und lime `::selection` entfernen. Prüfen, dass `--warning` mit Vordergrund 4,5:1 erreicht; wenn nicht, Gelb nur als Fläche mit Ink-Text.
- [ ] **Step 4: Verwendungen umstellen** nach Rolle (nicht blind ersetzen, jede Stelle gegen ihren Hintergrund lesen): gefüllte Aktionsfläche (`bg-notar-500/600/700/800/900`) → `bg-primary text-primary-foreground`; helle Tönung (`bg-notar-100/200`) → `bg-accent` oder `bg-muted`; Text `text-notar-700…950` → `text-foreground`; Text auf dunkler Fläche (`text-notar-100…400`) → `text-primary-foreground` oder `text-muted-foreground`; `border-notar-*` → `border-border`; `ring-notar-*` → `ring-ring`; Statusbedeutung (grün/gelb/rot) → `success`, `warning`, `destructive`. `Button` und `StatusBadge` zuerst, danach Views.
- [ ] **Step 4a:** Am `Button`-Primitive prüfen, dass `disabled` und Pending erkennbar bleiben (Review Focus 5); ggf. `disabled:opacity-*` ergänzen.
- [ ] **Step 5:** `npx vitest run src/app/globals.test.ts` → Expected: PASS. Schutzprobe: eine `bg-notar-500` testweise in eine Komponente setzen, Test muss rot werden; zurücknehmen.
- [ ] **Step 6:** `npm run check` und `npm test` → Expected: 0 Fehler.
- [ ] **Step 7:** Commit `feat(design): Ivory/Ink-Tokens, notar-Palette entfernt`.

### Task 4: Serif, Mono und Typo-Skala

**Files:**

- Modify: `src/app/layout.tsx`, `src/app/globals.css` (`@theme`: `--font-serif`, `--font-mono`), Titel-Komponenten (`src/components/views/DossierDetailView.tsx`, `src/components/DocumentTable/DocumentTable.tsx`, Aktenzeichen-Anzeigen), Stellen aus der Mängelliste (Typo)

**Interfaces:**

- Produces: Tailwind-Klassen `font-serif` (Akten- und Dokumenttitel) und `font-mono` (Aktenzeichen, Flurstücknummern).

- [ ] **Step 1:** Serifenschrift wählen (Empfehlung Source Serif 4; Verfügbarkeit in `next/font/google` gegen aktuelle Doku prüfen), mit `display: 'swap'` einbinden; `Geist_Mono` ist schon da und wird als `--font-mono` gemappt.
- [ ] **Step 2:** Titel und Aktenzeichen-Stellen per `grep` finden und `font-serif` bzw. `font-mono` setzen; Überschriften `font-bold tracking-tight`.
- [ ] **Step 3:** Typo-Mängel aus Task 1 beheben (`text-xs` und kleiner nur noch in Status-Pills).
- [ ] **Step 4:** `npm run test:quality` → Expected: CLS ≤ 0.1 (Review Focus 4), axe ohne schwere Verstöße.
- [ ] **Step 5:** Commit `feat(design): Serif für Aktentitel, Mono für Aktenzeichen, Typo-Skala`.

### Task 5: Nachprüfung vorher/nachher

**Files:**

- Modify: `docs/design/audit-2026-10.md` (Abschnitt „Nachprüfung")

- [ ] **Step 1:** Screenshots wie in Task 1 erneut erzeugen, je Ansicht mit Vorher vergleichen: kein Layoutsprung, Fokusring auf Buttons, Eingaben und Tabellenzeilen per Tastatur sichtbar (Review Focus 3), Touch-Ziele bei 390 px ≥ 44 px.
- [ ] **Step 2:** Verbleibende Mängel entweder beheben oder als offen mit Grund in die Liste schreiben.
- [ ] **Step 3:** `npm run check`, `npm test`, `npm run test:quality` ausführen und Ergebnisse notieren.
- [ ] **Step 4:** Commit `docs: Design-Audit Nachprüfung`.

### Task 6: Docs-Parität und Abschluss

**Files:**

- Modify: `docs/overview.md`, `ROADMAP.md`, `BACKLOG.md` (§15, §21), `CHANGELOG.md`, `AGENTS.md` (Abschnitt 3: Verweis auf `notar-*`-Akzente streichen), `docs/superpowers/specs/2026-10-15-produkt-design-fundament-design.md` (Dark Mode aus dem Audit-Umfang streichen, Status setzen)

- [ ] **Step 1:** `docs/overview.md` verweist auf PRODUCT.md und DESIGN.md. `ROADMAP.md`: C.6 durch dieses Teilprojekt ersetzen, Phasen 2 bis 5 aus der Spec eintragen; BACKLOG §15 und §21 abgleichen (erledigte Punkte entfernen).
- [ ] **Step 2:** `grep -rn "notar-[0-9]\|Limette\|lime" --include=*.md --include=*.mjs --include=*.json .` ohne `node_modules` prüfen; Treffer anpassen (z. B. `.agents/skills`, Lint-Konfiguration).
- [ ] **Step 3:** `npm run check` → Expected: 0 Fehler, Health ≥ 90.
- [ ] **Step 4:** CHANGELOG-Eintrag, DoD-Receipt (AGENTS.md 4C) in der Abschlussmeldung; Migration `NOT_REQUIRED`.
- [ ] **Step 5:** Commit `docs: Design-Fundament abgeschlossen`.
