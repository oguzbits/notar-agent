# Originale je Vorgang und Seitenansicht am Beleg – Spec

Teilprojekt „Beleg-Cockpit“ aus der [Feature-Studie](2026-10-17-feature-studie-harvey-legora.md). Es setzt auf [Prüfung je Feld](2026-10-17-pruefung-je-feld-design.md) auf: Ein Prüfvermerk ist belastbarer, wenn der Notar die zitierte Seite neben dem Auszug sieht.

## Problem

Das Cockpit zeigt je Feld Quelle, Seite und Zitat. Die Seite selbst sieht der Notar nicht. Bei Scans und Bildern (im Testbestand 6 von 10 Fällen) ist das Zitat die Modellwiedergabe eines Bildes; ohne Blick auf das Original ist sie nicht überprüfbar.

## Ist-Stand (im Code geprüft)

- Originale liegen nur in der Job-Nutzlast (`dossier_jobs.payload.files`), entweder inline (`content`) oder im Bucket `dossier-files` (`storagePath`, Pfad `<Kanzlei>/<uuid>-<Name>`).
- `pruneCompletedJobs` entfernt abgeschlossene Jobs nach 24 Stunden; `deleteJob` entfernt zugehörige Storage-Dateien. Inline-Dateien liegen nie im Storage.
- Keine Route liefert ein Original aus. Die Löschpipeline (`deletion_tasks`, `_purge_dossier`) kennt nur Job-Pfade und das Archivpräfix `<Kanzlei>/archive/<Vorgang>/`.
- Aufbewahrung und Fristen sind rechtlich nicht geklärt ([BACKLOG](../../../BACKLOG.md) §20).

## Entscheidungen

1. **Dauerhafte Ablage je Vorgang.** Jede analysierte Datei wird unter `<Kanzlei>/archive/<Vorgang>/<uuid>-<Name>` im Bucket `dossier-files` abgelegt. Das Präfix kennt die Löschpipeline bereits; damit entfällt eine Erweiterung von `_purge_dossier`. Inline-Dateien werden dafür beim Lauf in den Storage geschrieben.
2. **Verknüpfung im Dossier, nicht im Job.** Die Quelle eines Feldes verweist über den Dateinamen auf eine Ablage; eine Tabelle `dossier_files` (Vorgang, Kanzlei, Dateiname, Pfad, Typ, Größe, SHA-256) hält die Zuordnung mit Mandantentrennung per RLS. Der Hash dient dem Nachweis, dass das angezeigte Original dem analysierten entspricht.
3. **Auslieferung nur über eine geprüfte Route** `GET /api/documents/[id]/files/[fileId]`: Sitzung, Kanzlei-Zugehörigkeit und Recht zum Lesen des Vorgangs werden serverseitig geprüft; Antwort als kurzlebige signierte Adresse, nie ein öffentlicher Pfad. Jeder Abruf wird im Audit-Trail vermerkt.
4. **Anzeige:** Neben dem Zitat eine Schaltfläche „Original ansehen“; Bilder und PDF-Seiten (`#page=<Seite>`) erscheinen in einem Seitenbereich. Alle vier Zustände (leer, lädt, Fehler mit Wiederholen, läuft) werden abgedeckt. Ohne Ablage (Altbestand) fehlt die Schaltfläche, ohne Fehlermeldung.
5. **Löschung:** Original und Zuordnung folgen dem Vorgang. Wird der Vorgang gelöscht, entstehen Aufgaben in `deletion_tasks`; ein Original überlebt seinen Vorgang nie.

## Offene Fragen an den Nutzer

- **Aufbewahrungsdauer und rechtliche Freigabe:** Dauerhafte Ablage von Mandantenunterlagen berührt Verschwiegenheit und Aufbewahrung (§ 20 im Backlog). Empfehlung: Ablage erst nach der Klärung produktiv schalten, bis dahin nur lokal und mit Demodaten.
- **Speicherkosten:** Scans sind groß. Empfehlung: Größenlimit je Datei beibehalten, keine Komprimierung in diesem Schritt.
- **Rechte:** Empfehlung: Lesen mit dem Recht, das den Vorgang selbst zeigt; kein neues Recht.

## Nicht enthalten

Scan-Transkription, Schwärzung, Versionierung von Originalen, Volltextsuche über Originale, Vorschaubilder je Seite.

## Wirkung und Nachweis

- Impact: `DECLARATION_STAGED` (neue Tabelle `dossier_files` samt RLS in der Domänenmigration `workflows`); Live-Abgleich nur mit Zustimmung.
- Tests (jeder wird ohne die Schutzfunktion rot): fremde Kanzlei erhält 404 statt Datei; ohne Sitzung 401; Pfad aus Client-Eingabe wird nie ausgeliefert; Hash der Ablage entspricht dem Original; Löschen des Vorgangs erzeugt Löschaufgaben für alle Originale; Abruf erzeugt genau einen Audit-Eintrag.
- Erfolgskriterium: `npm run check` und `npm test` grün; Seitenbereich bei 1440 und 390 px ohne Layout-Sprung.
