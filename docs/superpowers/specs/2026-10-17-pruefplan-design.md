# Prüfplan vor dem Lauf – Spec

Teilprojekt „Beleg-Cockpit“ aus der [Feature-Studie](2026-10-17-feature-studie-harvey-legora.md), Rangfolge Nr. 3. Baut auf der [Prüfung je Feld](2026-10-17-pruefung-je-feld-design.md) auf.

## Problem

Heute startet „Unterlagen prüfen“ sofort die Analyse. Der Notar sieht erst im Ergebnis, was geprüft wurde und welche Regeln galten. Harvey und Legora zeigen vorab einen Plan und holen eine Freigabe ein. Für das Notariat passt das zu „Prüfung durch Notar erforderlich“: Der Notar bestimmt, was geprüft wird, bevor Unterlagen verarbeitet werden.

## Ist-Stand (im Code geprüft)

- Der Upload ([NewVorgangUploadView.tsx](../../../src/components/views/NewVorgangUploadView.tsx)) hat genau einen Auslöser, der den Lauf sofort startet.
- Die Pflichtfelder je Vorgangsart stehen in `CASE_TYPE_METADATA_REGISTRY` ([constants.ts](../../../src/lib/dossier/constants.ts)).
- Die geltenden Regeln liegen in `knowledge_documents` und kommen über `IKnowledgeRepository.getStatutoryRules` ([pipeline.ts](../../../src/lib/ai/pipeline.ts) nutzt sie bereits im Lauf).

## Entscheidungen

1. **Plan ist eine Vorschau, kein neuer Zustand.** Er wird beim Klick auf „Unterlagen prüfen“ aus vorhandenen Daten abgeleitet und in einem Dialog gezeigt: Vorgangsart, gewählte Unterlagen (Name, Größe), die Pflichtfelder, die geprüft werden, und die Prüfregeln aus der Wissensbasis (Titel, Kategorie). Keine Speicherung, keine neue Tabelle.
2. **Freigabe ist der bisherige Start.** Der Dialog hat „Prüfung starten“ und „Abbrechen“. Der Start im Dialog ist der einzige Auslöser; der Knopf im Formular öffnet nur die Vorschau (Single Source of Action).
3. **Keine Regeln im Code.** Regelnamen kommen ausschließlich aus der Wissensbasis über eine neue Leseroute; die Pflichtfelder aus der vorhandenen Registry. Es gibt keine fest verdrahtete Planliste.
4. **Hinweis bei Lücken statt Sperre:** Fehlen Regeln in der Wissensbasis oder nur ungeprüfte (`UNGEPRUEFT`), steht das im Plan sichtbar („nicht geprüfte Regelgrundlage“). Der Notar entscheidet, ob er startet.
5. **Audit (umgesetzt als eigener Schritt, siehe Architektur „Prüfgrundlage im Audit-Trail“):** Beim Start eines Jobs wird heute kein Audit-Eintrag geschrieben (`DOCUMENT_INGESTED` wird im Code nirgends erzeugt). Regel-IDs im Audit festzuhalten braucht erst diesen Eintrag und ist ein eigener Schritt.

## Offene Fragen an den Nutzer

- **Muss jeder Lauf freigegeben werden?** Empfehlung: ja, ein Dialog je Start; das Einsparen des Klicks ist kein Ziel.
- **Darf der Notar Regeln im Plan abwählen?** Empfehlung: nein in diesem Schritt. Abwahl verändert die Prüfung und braucht eine eigene Entscheidung (Playbooks, Rang danach).

## Nicht enthalten

Audit der Planfreigabe, Abwahl oder Bearbeiten von Regeln, Playbooks, Plan für Nachreichungen, Kostenvorschau.

## Wirkung und Nachweis

- Impact: `LOCAL_CODE_ONLY`, keine Migration (Annahme zu `audit_logs.details` ohne Einschränkung; nicht gegen Live geprüft).
- Neue Leseroute für die Regelgrundlage; Authentifizierung und Mandantentrennung wie bei den übrigen Leseroutes.
- Tests (jeder wird ohne die Schutzfunktion rot): Route liefert nur Regeln der eigenen Kanzlei und keine zurückgezogenen; Plan nennt keine Regel, die nicht aus der Wissensbasis stammt; der Lauf startet erst nach der Freigabe im Dialog; Abbrechen startet nichts.
- Erfolgskriterium: `npm run check` und `npm test` grün, Dialog bei 1440 und 390 px ohne Layoutsprung (Playwright-Qualitätstest).
