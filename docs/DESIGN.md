---
name: Notar Agent
description: Prüfwerkzeug für Notariate. Jede Angabe trägt ihre Fundstelle, Grün bestätigt nur Belegtes.
colors:
  primary: '#a2e771'
  primary-hover: '#83df41'
  primary-pressed: '#66c622'
  primary-ink: '#284e0d'
  primary-tint: '#e7f9da'
  primary-border: '#b9ed94'
  focus-ring: '#356611'
  background: '#ffffff'
  foreground: '#0f172a'
  muted: '#f1f5f9'
  muted-foreground: '#334155'
  border: '#e2e8f0'
  destructive: '#ff0000'
  warning: '#e1cb05'
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '-0.025em'
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '1rem'
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  xl: '12px'
  2xl: '16px'
spacing:
  card-padding: '24px'
  card-padding-wide: '32px'
  header-height: '64px'
  content-max: '80rem'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-ink}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-primary-pressed:
    backgroundColor: '{colors.primary-pressed}'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  button-ghost:
    textColor: '{colors.muted-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  input:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    height: '44px'
  card:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.2xl}'
    padding: '{spacing.card-padding}'
  status-badge-verified:
    backgroundColor: '{colors.primary-tint}'
    textColor: '{colors.primary-ink}'
    rounded: '{rounded.md}'
    padding: '6px 12px'
---

# Design System: Notar Agent

> **Zweck:** Verbindliche Gestaltungsregeln für jede Oberfläche. Die Werte stammen aus [src/app/globals.css](../src/app/globals.css) und [src/components/ui/](../src/components/ui/); bei Abweichung gilt der Code. Die Regeln werden per `@shadcn/lint` in [eslint.config.mjs](../eslint.config.mjs) erzwungen. Der Kopfbereich (YAML) ist maschinenlesbar und maßgeblich für die Werte, der Text erklärt ihre Anwendung.

## Overview

**Creative North Star: „Das Prüfprotokoll“**

Das Notar-Cockpit liest sich wie ein sauber geführtes Protokoll: Jede Angabe steht mit Datei, Seite und Zitat da, nichts wird behauptet, was nicht belegt ist. Die Oberfläche tritt zurück. Weiße Flächen, feine Linien, ruhige Karten; Farbe erscheint nur dort, wo sie etwas aussagt. Das Grün bedeutet „belegt“ und ist die einzige Signalfarbe des Systems, Gelb und Orange markieren Prüfbedarf, Rot den Fehler.

Die Dichte ist die eines Arbeitswerkzeugs für konzentrierte Prüfarbeit: Tabellen und Felder sind kompakt, aber nie kleiner als lesbar (Fließtext mindestens 16 px). Es gibt nur ein helles Erscheinungsbild. Es ist ein Werkzeug und kein Marketing-Auftritt; Paragraphenverweise (z. B. § 203 StGB) dienen nie als dekorative Slogans in Kopfzeilen oder Badges.

**Key Characteristics:**

- Belegorientiert: Fundstellen und Zustände stehen immer in Reichweite.
- Flach und hell: Tiefe entsteht durch Linien und Karten, nicht durch Schatten.
- Genau eine Signalfarbe (Grün) für „belegt“; Warnstufen in Gelb und Orange.
- Alle Texte in deutscher Notarsprache, kein Denglisch, keine KI-Fachbegriffe.

## Colors

Ein weißes Papier, fast schwarze Tinte in Blaugrau, und ein frisches Grün als Bestätigung. Alle Werte sind semantische Tokens aus `globals.css`; die Hex-Angaben stehen für die dort in HSL definierten Werte.

### Primary

- **Siegelgrün** (`#a2e771`, Skala `notar-50` bis `notar-950`): Primäre Schaltflächen, Fokusring-Akzent, Auswahlfarbe und der Zustand „belegt“. Auf Grün steht immer dunkles Grün-Schwarz (`#284e0d`, `notar-950`), nie Weiß.
- **Siegelgrün gedrückt** (`#83df41` beim Überfahren, `#66c622` beim Drücken): Zustände der primären Schaltfläche.
- **Belegt-Fläche** (`#e7f9da` mit Rand `#b9ed94`): Hintergrund von Status-Badges für „Belegt“, „Entwurfsreif“ und „Abgeschlossen“.
- **Fokus-Grün** (`#356611`, `notar-900`): Fokusring von Schaltflächen und Eingaben.

### Neutral

- **Aktenweiß** (`#ffffff`): Seite, Karten und Eingabefelder.
- **Tintenblau** (`#0f172a`): Text, Überschriften.
- **Gedämpftes Schiefer** (`#334155`): Sekundärtext, Hilfetexte, Zeitstempel.
- **Linienblau** (`#e2e8f0`): Rahmen, Trennlinien, Eingabefelder.
- **Blasses Blaugrau** (`#f1f5f9`): ruhige Flächen, Hover-Hintergründe, Sekundär-Schaltfläche.

### Signal

- **Warngelb** (`--warning`, `#e1cb05`) und die Statusfarben in `StatusBadge` (Bernstein für „Prüfung nötig“ und „In Prüfung“, Orange für „Veraltet“, Himmelblau für „In Warteschlange“, Grau für „Fehlt“ und „Abgebrochen“).
- **Fehlerrot** (`#ff0000`, `--destructive`): Fehlermeldungen und fehlgeschlagene Vorgänge.

### Named Rules

**The Beleg-Only Green Rule.** Grün steht für „belegt“ oder für die eine Hauptaktion einer Ansicht. Es wird nicht als Dekoration, Hintergrund großer Flächen oder Marken-Verzierung eingesetzt.

**The Semantic Token Rule.** In Feature-Views gibt es nur semantische Tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive` und die `notar-*`-Skala. Rohe Tailwind-Palettenfarben (`bg-slate-100`, `text-blue-500`) sind dort verboten. Die Primitive in `src/components/ui/` (`Button`, `StatusBadge`) enthalten selbst Palettenfarben; neue Statusfarben werden dort ergänzt, nie in Views.

## Typography

**Schrift:** Systemschrift (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`), gesetzt in `globals.css` am `body`.

**Hinweis (Abweichung):** [src/app/layout.tsx](../src/app/layout.tsx) lädt Geist Sans und Geist Mono und legt sie als Variablen `--font-geist-sans` und `--font-geist-mono` an. Keine Regel greift darauf zu, die Oberfläche rendert in der Systemschrift. Entweder wird Geist angebunden oder das Laden entfernt; bis dahin gilt die Systemschrift.

**Character:** Neutral, vertraut und gut lesbar auf jedem Arbeitsplatzrechner einer Kanzlei; keine Schrift, die sich in den Vordergrund drängt.

### Hierarchy

- **Headline** (700, `text-2xl`/`text-3xl`, `tracking-tight`): Seiten- und Kartentitel.
- **Title** (700, `text-xl`, `tracking-tight`): Dialogtitel, Abschnitte.
- **Body** (400, 1 rem, Zeilenhöhe 1.6): Fließtext, Eingaben, Beschriftungen.
- **Label** (500 bis 600, 1 rem): Feldbeschriftungen, Schaltflächen.
- **Caption** (400, `text-sm` = 14 px): Hilfetexte, Zeitstempel, kompakte Tabellenzellen.
- **Pille** (`text-xs`, auch `text-2xs` 11 px und `text-3xs` 10 px als definierte Tokens): ausschließlich kompakte Status-Pills und Badges.

### Named Rules

**The Sixteen Pixel Rule.** Fließtext, Bedienelemente, Eingaben und Beschriftungen stehen mindestens in `text-base` (16 px). `text-sm` ist für Hilfetexte, Zeitstempel und Tabellenzellen reserviert; `text-xs` nur in Status-Pills.

**The Tight Heading Rule.** Überschriften nutzen `text-xl`, `text-2xl` oder `text-3xl`, immer mit `font-bold` und `tracking-tight`.

## Layout

Eine einspaltige Arbeitsfläche mit einer Kopfzeile von 64 px Höhe (`h-16`, haftend am oberen Rand, leicht durchscheinender Hintergrund mit Weichzeichner) und einem Inhaltsbereich bis `max-w-7xl` (80 rem), mit seitlichem Rand von 16, 24 und 32 px je nach Breite (`px-4 sm:px-6 lg:px-8`). Dialoge und Formulare nutzen schmale Breiten (`max-w-md` bis `max-w-xl`).

Karten haben innen 24 px, ab `sm` 32 px. Zeilen in Tabellen sind kompakt (vertikal 10 px); Felder in Formularen haben eine Mindesthöhe von 44 px für sichere Bedienung. Der Abstand innerhalb von Gruppen folgt der Tailwind-Skala (`gap-1.5` bis `gap-4`), ohne eigene Spacing-Tokens.

Die Zustände eines asynchronen Bereichs verändern das Layout nie: Skeletons und Spinner belegen den Platz der späteren Inhalte (kein CLS).

## Elevation & Depth

Flach im Ruhezustand. Tiefe kommt von Linien (`border-border`) und der Karte, nicht von Schatten. Schatten sind sparsam und ausschließlich strukturell.

- **Haarschatten** (`shadow-xs`, `shadow-2xs`): Schaltflächen und Eingaben, kaum sichtbar; 45 Verwendungen im Code.
- **Karten-Schatten** (`shadow-sm`): Karten.
- **Dialog und Overlay** (`bg-black/50` mit `backdrop-blur-xs`): Hintergrund hinter Dialogen; der Dialog selbst ist eine Karte mit `rounded-2xl`, Rand und `shadow-2xl`.
- **Kopfzeile** (`bg-background/95` mit `backdrop-blur`): bleibt beim Scrollen sichtbar, ohne Schatten.

### Named Rules

**The Flat-By-Default Rule.** Flächen sind im Ruhezustand flach. Ein starker Schatten (`shadow-2xl`) erscheint nur für schwebende Ebenen (Dialoge), nie für Karten im Fluss.

## Shapes

Weiche, aber nicht runde Ecken. `--radius` ist 0.5 rem (8 px), daraus ergeben sich `rounded-lg` (8 px), `rounded-md` (6 px) und `rounded-sm` (4 px).

- **Schaltflächen und Status-Badges:** `rounded-md` (6 px).
- **Eingabefelder:** `rounded-lg` (8 px).
- **Karten und große Container:** `rounded-xl` bis `rounded-2xl` (12 bis 16 px).
- **Runde Elemente** (`rounded-full`): kleine Punkte, Symbolkreise und Zähler sowie Pillen auf der Auswertungsseite.

Rahmen sind 1 px in Linienblau; Hervorhebung geschieht über Farbe und Fokusring, nicht über dickere Rahmen.

## Components

Alle Oberflächen werden aus den Bausteinen in [src/components/ui/](../src/components/ui/) zusammengesetzt (`Button`, `Input`, `Card`, `ConfirmDialog`, `BaseModalShell`, `StatusBadge`, `ErrorBoundary`).

### Buttons

Selbstbewusst und klar: halbfett, mit sichtbarem Fokusring.

- **Shape:** `rounded-md` (6 px); Größen `sm` (`text-sm`, 14 px), `md` (`text-base`, Standard) und `lg` (`text-lg`).
- **Primary:** Siegelgrün (`#a2e771`) mit Text `#284e0d` und Haarschatten; dies ist die eine Hauptaktion einer Ansicht.
- **Hover / Pressed:** Grün dunkelt auf `#83df41`, dann `#66c622`.
- **Focus:** Ring 2 px in `notar-900` mit 2 px Abstand.
- **Secondary / Outline / Ghost / Danger:** Blassgrau, weiß mit Rahmen, nur Text, Rot-Tönung. Danger ist hell getönt, nie vollflächig rot.
- **Disabled / Läuft:** 50 % Deckkraft und `cursor-not-allowed`; im Zustand „läuft“ ersetzt ein Spinner das Icon, die Schaltfläche ist gesperrt.

### Cards / Containers

- **Corner Style:** `rounded-2xl` (16 px).
- **Background:** Weiß, Text Tintenblau.
- **Shadow Strategy:** `shadow-sm`, siehe Elevation.
- **Border:** 1 px Linienblau; der Fußbereich trennt mit `border-t`.
- **Internal Padding:** 24 px, ab `sm` 32 px.

### Inputs / Fields

- **Style:** Weiß, 1 px Rand in Linienblau, `rounded-lg`, Mindesthöhe 44 px, Text 16 px.
- **Hover:** Rand dunkelt leicht (`foreground/30`).
- **Focus:** 2 px Ring in `notar-900`, Rand verschwindet.
- **Error / Disabled:** Rand und Ring rot, Fehlermeldung in `text-sm` mit `role="alert"` unter dem Feld; deaktiviert mit 50 % Deckkraft. Beschriftung, Hilfetext und Fehler sind per `aria-describedby` verknüpft.

### Status-Badges

Signaturelement des Cockpits: Icon, Farbfläche und Wort in einer Pille (`rounded-md`, 1 px Rand). Die Bedeutung hängt nie allein an der Farbe, jedes Badge trägt Icon und Text. Grün: „Belegt“, „Entwurfsreif“, „Abgeschlossen“; Bernstein: „Prüfung nötig“, „In Prüfung“; Orange: „Veraltet“; Blau: „In Warteschlange“; Rot getönt: „Fehlgeschlagen“; Grau: „Fehlt“, „Abgebrochen“. Statusfarben kommen ausschließlich aus [StatusBadge](../src/components/ui/StatusBadge.tsx).

### Dialoge

`BaseModalShell` (Radix Dialog) und `ConfirmDialog`: abgedunkelter, leicht weichgezeichneter Hintergrund, Titel in `text-xl` fett mit Trennlinie, Beschreibung in 16 px Schiefer. Destruktive Bestätigungen nutzen die Danger-Variante.

### Navigation

Die Kopfzeile trägt links die Wortmarke (`BrandLogo`), rechts das Rollen-Badge (`RoleBadge`) und weitere Aktionen; sie ist 64 px hoch und bleibt beim Scrollen stehen.

## Do's and Don'ts

### Do:

- **Do** jede Oberfläche aus den Primitiven in `src/components/ui/` zusammensetzen (`Input`, `Button`, `Card`, `ConfirmDialog`, `BaseModalShell`, `StatusBadge`).
- **Do** für jede Nutzerabsicht in einer Ansicht genau einen Auslöser vorsehen; tote Bedienelemente sofort entfernen.
- **Do** Grün für „belegt“ und die eine Hauptaktion einer Ansicht reservieren.
- **Do** Fließtext, Bedienelemente und Beschriftungen in mindestens 16 px setzen.
- **Do** jeden Zustand mit Icon und Text kennzeichnen, nicht nur mit Farbe.

### Don't:

- **Don't** rohes `<input>`, `<select>`, `<label>` oder eigene Karten-`div`s in `src/app/` und `src/components/views/` schreiben.
- **Don't** rohe Tailwind-Palettenfarben in Views verwenden; nur semantische Tokens.
- **Don't** `text-xs` für Text oder Beschriftungen setzen.
- **Don't** Paragraphenverweise oder Rechtsabkürzungen als dekorative Slogans in Kopfzeilen oder Badges zeigen.
- **Don't** technische KI-Begriffe (RAG, Vektor, Token, Embedding, Pipeline-Stufen) in sichtbaren Texten verwenden.
- **Don't** ein dunkles Erscheinungsbild annehmen: Es gibt keine Dark-Mode-Tokens, die Seite ist auf „hell“ festgelegt.

## Zustände (vollständiges Quadrat)

Jede asynchrone Ansicht behandelt alle vier Zustände:

1. **Leer:** Klarer Text ohne Daten mit einer Handlungsaufforderung.
2. **Laden:** Zugängliche Skeletons oder Spinner, die keinen Layoutsprung (CLS) verursachen.
3. **Fehler:** Verständliche Meldung mit „Erneut versuchen“.
4. **Läuft:** Bedienelemente deaktiviert und Spinner am Button, damit nichts doppelt abgeschickt wird.

## Sprache

Sichtbare Texte nutzen die kanonische deutsche Notarterminologie aus [src/lib/dossier/constants.ts](../src/lib/dossier/constants.ts), ohne Denglisch.

## Durchsetzung

`shadcn/no-raw-colors`, `shadcn/no-restyle`, `shadcn/no-arbitrary-values`, `shadcn/no-inline-styles` und `shadcn/require-static-classes` laufen in `npm run lint`. Layoutstabilität und Barrierefreiheit prüft `npm run test:quality` (CLS und axe). Änderungen an der Oberfläche werden vor Abschluss im Browser geprüft.
