# Notar Agent — Design-System

> **Zweck:** Verbindliche Gestaltungsregeln für jede Oberfläche. Die Werte stammen aus [src/app/globals.css](../src/app/globals.css) und [src/components/ui/](../src/components/ui/); bei Abweichung gilt der Code. Die Regeln werden per `@shadcn/lint` in [eslint.config.mjs](../eslint.config.mjs) erzwungen.

## Charakter

Sachlich, ruhig, belegorientiert. Das Notar-Cockpit ist ein Arbeitswerkzeug für konzentrierte Prüfarbeit, kein Marketing-Auftritt: viel Weißraum, klare Ampelzustände, Fundstellen immer in Reichweite. Paragraphenverweise (z. B. § 203 StGB) dienen nie als dekorative Slogans in Kopfzeilen oder Badges.

## Farben

- Nur semantische Tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive` und die `notar-*`-Akzentskala (50–950, Grün, Primärton `notar-500`).
- Keine rohen Tailwind-Palettenfarben (`bg-slate-100`, `text-blue-500`) in Feature-Views.
- Statusfarben kommen ausschließlich über `StatusBadge` ([src/components/ui/StatusBadge.tsx](../src/components/ui/StatusBadge.tsx)).

## Typografie

- Schriften: Geist Sans (Text) und Geist Mono (Zitate, Kennungen), geladen in [src/app/layout.tsx](../src/app/layout.tsx).
- Fließtext, Bedienelemente, Eingaben und Beschriftungen mindestens `text-base` (16 px).
- `text-sm` nur für Hilfetexte, Zeitstempel und kompakte Tabellenzellen. `text-xs` nur in kompakten Status-Pills und Badges, nie für Text oder Beschriftungen.
- Überschriften: `text-xl`, `text-2xl` oder `text-3xl`, immer mit `font-bold` und `tracking-tight`.

## Komponenten

- **Primitive zuerst:** Kein rohes `<input>`, `<select>`, `<label>` und keine eigenen Karten-`div`s in `src/app/` und `src/components/views/`. Es werden die Bausteine aus `src/components/ui/` verwendet (`Input`, `Button`, `Card`, `ConfirmDialog`, `BaseModalShell`, `StatusBadge`).
- **Eine Aktion, ein Auslöser:** Für jede Nutzerabsicht in einer Ansicht gibt es genau einen kanonischen Auslöser. Doppelte Wege zum selben Ergebnis sind verboten, tote Bedienelemente werden sofort entfernt.
- **Radius:** `--radius` (0.5 rem) über die Tailwind-Stufen `rounded-sm|md|lg`.

## Zustände (vollständiges Quadrat)

Jede asynchrone Ansicht behandelt alle vier Zustände:

1. **Leer:** Klarer Text ohne Daten mit einer Handlungsaufforderung.
2. **Laden:** Zugängliche Skeletons oder Spinner, die keinen Layoutsprung (CLS) verursachen.
3. **Fehler:** Verständliche Meldung mit „Erneut versuchen“.
4. **Läuft:** Bedienelemente deaktiviert und Spinner am Button, damit nichts doppelt abgeschickt wird.

## Sprache

Sichtbare Texte nutzen die kanonische deutsche Notarterminologie aus [src/lib/dossier/constants.ts](../src/lib/dossier/constants.ts), ohne Denglisch. Technische KI-Begriffe (RAG, Vektor, Token, Embedding, Pipeline-Stufen) erscheinen nie in der Oberfläche.

## Durchsetzung

`shadcn/no-raw-colors`, `shadcn/no-restyle`, `shadcn/no-arbitrary-values`, `shadcn/no-inline-styles` und `shadcn/require-static-classes` laufen in `npm run lint`. Layoutstabilität und Barrierefreiheit prüft `npm run test:quality` (CLS und axe). Änderungen an der Oberfläche werden vor Abschluss im Browser geprüft.
