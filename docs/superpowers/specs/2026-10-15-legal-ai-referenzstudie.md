# Referenzstudie Harvey und Legora (Stand Oktober 2026)

Grundlage für DESIGN.md und die Teilprojekte 2 und 3. Hexwerte und Schriften stammen aus dem öffentlichen CSS und Quelltext der Marketing-Websites, nicht aus den (login-geschützten) Apps. Jede Aussage trägt den Status belegt, unsicher oder nicht gefunden.

## Design-Sprache

| Aspekt      | Harvey (belegt, [harvey.ai](https://www.harvey.ai/))                          | Legora (belegt, [legora.com](https://legora.com))                                            |
| ----------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Schrift     | HarveySerif (Titel), HarveySansDiatype Variable (Text), System-Mono           | Legora Sans (Text), Geist Mono und Fragment Mono (Labels), Playfair Display (Serif, sparsam) |
| Hintergrund | Ivory `#fafaf9`, Grauskala `#f2f1f0` bis `#1f1d1a`                            | `#FEFEFC`, Flächen `#F4F4F0` und `#ECECE7`                                                   |
| Text        | Ink `#0f0e0d`                                                                 | `#0D1016`, sekundär `#68655E`                                                                |
| Akzent      | Kein Markenakzent im UI; Status Grün `#16a34a`, Gelb `#eab308`, Rot `#f26161` | Dunkelgrün `#00301E`, Lime `#D0F289`, Orange `#E68846`                                       |
| Radien      | 2, 4, 6, 8, 12 px                                                             | Pills 99 px, Kleinteile 5 px                                                                 |
| Dark Mode   | `color-scheme` light und dark, Themes black, gray, white                      | Für das Produkt nicht belegt                                                                 |

Gemeinsamer Nenner: warme Neutraltöne statt Blau-Weiß, Serif nur für Titel und Dokumentköpfe, ruhige Flächen, ein einziger dunkler Akzent (Legora) oder gar keiner (Harvey).

## Produktmuster

- **Review-Tabelle:** Dokument oder Prüfpunkt als Zeile, Frage als Spalte. Harvey: Zellen kommentieren, bearbeiten, verifizieren, Aktivität verfolgen (Teaser, teils login-geschützt). Legora: „Mark as Reviewed", „Lock Cells", „Review Mode" ([Tabular Review](https://legora.com/product/tabular-review)).
- **Beleg:** Harvey „links every answer back to the exact sources used" ([Hilfe](https://eu.help.harvey.ai/articles/getting-started-with-harvey)). Die Darstellung des Zitats selbst (Popover oder Sprung) ist bei beiden nicht belegt.
- **Prüfplan vor dem Lauf:** Harvey zeigt vorab den Plan und holt eine Freigabe ein ([Agents](https://www.harvey.ai/platform/agents)).
- **Playbooks:** Legora: Startpositionen, Non-Negotiables, Fallbacks, im Word-Add-in ([Word-Add-in](https://legora.com/product/word-add-in)).
- **Navigation:** Harvey-Sidebar mit Assistant, Vault, Workflow Agents, History, Library; Strg+K sucht Vaults, Threads und Agents.
- **Vertrauen:** SOC 2 Type II, ISO 27001 und weitere, Audit-Logs, „human verification is critical".

## Nicht gefunden

Leer-, Lade- und Fehlerzustände, Onboarding-Flow, Tastenkürzel in Review-Tabellen, Freigabe-Stufen, Zitat-Darstellung in der App. Hier gelten die Vorgaben aus [AGENTS.md](../../../AGENTS.md); die Lücken werden als eigene Entwurfsentscheidung gekennzeichnet.

## Übernahmen für das Notar-Tool

1. Warme Neutraltöne und genau ein dunkler Akzent als semantische Tokens; Statusfarben getrennt vom Akzent.
2. Serif nur für Akten- und Dokumenttitel; Mono für Aktenzeichen und Flurstücknummern.
3. Prüfpunkt-Tabelle mit Fundstelle (Dokument, Seite, Klausel) und Zellstatus offen, geprüft, beanstandet.
4. Strg+K über Akten, Dokumente und offene Prüfpunkte.
5. Vertrauensleiste mit Datenresidenz und Audit-Log-Link; Hinweis „Prüfung durch Notar erforderlich" am Ergebnis; keine Paragraphen als Badge (AGENTS Abschnitt 2, Punkt 6).

## Ergänzung: REA-Beobachtung der öffentlichen Startseiten (2026-10-15)

Methode: passive Inspektion und Viewport-Screenshot (1440 × 900) der Startseiten ohne Anmeldung, per REA über einen isolierten Chrome mit leerem Profil. REA wertet kein JavaScript aus, liefert also keine berechneten Stile. Die Bilder zeigen Marketing-Material, nicht die Anwendungen.

- **Harvey** ([harvey.ai](https://www.harvey.ai/)): Ivory-Fläche, Serif-Überschrift in sehr großer Größe, kleine rechteckige Buttons in Schwarz (geringe Rundung). Das gezeigte Produktbild nutzt eine dunkle Seitenleiste mit Neuer Thread, Agents, Vaults, Command Center, More, darunter Apps und Zuletzt; der Seitentitel steht in Serif, Aktionen sind schwarze Buttons und kleine Schalter.
- **Legora** ([legora.com](https://legora.com/)): Dunkelgrüne Ankündigungsleiste, dunkelgrüner Pill-Button mit rundem Pfeil-Symbol, serifenlose Überschrift, zentriertes Wortlogo, Navigation links, Anmeldung und Demo-Button rechts.
- **Bestätigt:** Harvey wirkt über Serif und Schwarz-auf-Ivory, Legora über einen dunklen Grünakzent mit Pill-Buttons. Die Aussagen der Tabelle oben decken sich mit den Bildern.
- **Nicht belegt:** Farbwerte und Schriften aus berechneten Stilen, Dichte der echten Anwendung, Zitat-Darstellung.
