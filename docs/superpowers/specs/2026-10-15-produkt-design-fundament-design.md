# Produkt- und Design-Fundament – Spec

Teilprojekt der Premium-Initiative, eingeordnet als Stufe 4 im Programm der [Bestandsaufnahme](2026-10-16-bestandsaufnahme.md). Es beginnt erst nach Mandantentrennung (Stufe 0) und Gates (Stufe 1).

## Ziel

Produkt und Software auf Premium-Industriestandard für Legal-Tech heben. Dieses Teilprojekt legt das Produkt- und Design-Fundament, an dem alle Folgeprojekte ausgerichtet werden.

## Umfang

1. **Design-Audit der Ist-UI.** Playwright-Screenshots der Hauptansichten (Login, Vorgangspostfach, Upload, Fortschritt, Cockpit, Team) bei 1440 und 390 px, hell und dunkel. Ergebnis ist eine Mängelliste (Kontrast, Typo-Skala, Dichte, Zustände, Touch-Ziele), kein Umbau.
2. **PRODUCT.md.** Zielnutzer (Notar, Notarfachangestellte, Reviewer), Positionierung („jede Aussage mit Beleg"), Produktprinzipien, Abgrenzung.
3. **DESIGN.md.** Nordstern, Farb-, Typografie-, Radius-, Dichte- und Zustandsregeln, Do's and Don'ts. Die Design-Sprache wird aus einer ausführlichen Studie der Legal-AI-Marktführer Harvey und Legora (Produktseiten, Demos, Screenshots, Hilfe-Center) und dem Audit der Ist-UI abgeleitet.
4. **Token-Umbau.** Die Markenpalette `notar-*` (Limettengrün) wird durch eine warme Neutralpalette nach Harvey-Vorbild ersetzt (Ivory-Flächen, Ink-Text, kein Markenakzent; Farbe nur für Status und Fokus); Serif für Akten- und Dokumenttitel, Mono für Aktenzeichen; Typo-Skala nach AGENTS.md Abschnitt 3. Keine Feature-Änderungen.
5. **Docs-Parität.** [docs/overview.md](../../overview.md) verweist auf PRODUCT.md und DESIGN.md; ROADMAP.md erhält die Phasen 2 bis 5.

## Entscheidungen

- **Richtung Harvey-nah (vom Nutzer gewählt):** Farbe trägt Bedeutung (Status, Fokus, Auswahl, Beleg), nicht Dekoration. Werte und Belege stehen in [der Referenzstudie](2026-10-15-legal-ai-referenzstudie.md); sie werden im Audit gegen die Ist-UI geprüft und als semantische Tokens umgesetzt.
- **Semantische Tokens bleiben der einzige Weg:** Komponenten nutzen weiterhin ausschließlich Tokens; der Umbau geschieht zentral in `globals.css`. Das hält `@shadcn/lint` grün und begrenzt die Diff-Größe.
- **Design-Quelle:** Harvey und Legora sind die maßgebliche Referenz für Optik und Produktmuster (Beleg pro Satz, Zellstatus, Playbooks).
- **NotebookLM-Klon:** Quelle ausschließlich für Engineering-Verbesserungen (Code, Checks, Docs, Tests, agentische Entwicklung), siehe Teilprojekte 4 und 5, nie für Design oder Produkt.

## Nicht enthalten

Beleg-Cockpit (Teilprojekt 2), Review-Tabelle und Playbooks (Teilprojekt 3), CI- und Testumbau (Teilprojekte 4 und 5).

## Wirkung und Nachweis

- Impact: `LOCAL_CODE_ONLY`, keine Migration.
- Erfolgskriterium: `npm run check` und `npm test` grün; Screenshots vorher/nachher ohne Layout-Sprung; Docs-Links relativ und portabel.
