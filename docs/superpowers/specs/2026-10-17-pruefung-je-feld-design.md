# Prüfung je Feld durch den Notar – Spec

Teilprojekt „Beleg-Cockpit“ aus der [Feature-Studie](2026-10-17-feature-studie-harvey-legora.md), Rangfolge Nr. 2. Es setzt auf der Belegprüfung (F01) auf: Erst wenn `VERIFIED` ein geprüfter Beleg ist, lohnt sich die menschliche Bestätigung.

## Problem

`VERIFIED` heißt heute „die Pipeline hat den Beleg gefunden“. Ob ein Mensch das Feld gesehen hat, steht nirgends am Feld, sondern nur indirekt im Audit-Trail, und nur, wenn der Status geändert wurde. Wer ein maschinell belegtes Feld bestätigt, ohne es zu ändern, hinterlässt keine Spur. Das widerspricht dem Produktprinzip „Prüfung durch Notar erforderlich“ und ist der Teil, den die Anbieter-Studie als Chance ausweist (Zellstatus offen, geprüft, beanstandet).

## Ist-Stand (im Code geprüft)

- Cockpit zeigt Quelle, Seite und Zitat ([CockpitTableRow.tsx](../../../src/components/FieldCockpit/subcomponents/CockpitTableRow.tsx)).
- Statuswechsel mit Pflichtbegründung und Audit-Eintrag `USER_STATUS_OVERRIDE` existiert (`PUT /api/analyze`, Recht `OVERRIDE_FIELD_STATUS`).
- Das Recht `FINAL_APPROVAL` (Notar, Notarassessor) ist definiert, aber weder in Routen noch in der Oberfläche verwendet.
- `audit_logs.action` hat nach Suche in den Migrationen keine Einschränkung auf feste Werte; eine neue Aktion braucht daher nach diesem Befund keine Migration. Gegen die Live-Datenbank nicht geprüft.

## Entscheidungen

1. **Orthogonal zum Status.** `FIELD_STATUS` bleibt unverändert (Befund der Pipeline oder Entscheidung per Override). Neu ist ein optionaler Prüfvermerk am Feld, `review: { confirmedAt, confirmedBy }`. Kein Vermerk heißt „Prüfung offen“.
2. **Dreiwertige Anzeige abgeleitet, nicht gespeichert:** offen (kein Vermerk), geprüft (Vermerk vorhanden), beanstandet (Status `NEEDS_REVIEW` durch Override mit Begründung). „Beanstanden“ ist der vorhandene Override; es gibt dafür keinen zweiten Weg (Single Source of Action).
3. **Bestätigen** ist eine eigene Aktion `FIELD_CONFIRMED` im Audit-Trail (Akteur und Rolle aus der Sitzung, nie aus dem Body), nur für Felder mit Status `VERIFIED`. Felder mit anderem Status bestätigt man, indem man den Status per Override ändert.
4. **Verfall:** Ändert eine erneute Analyse oder Nachreichung Daten, Quelle oder Status eines Feldes, wird der Vermerk gelöscht. Eine Bestätigung gilt nur für den Stand, den der Notar gesehen hat. Das ist die kritische Schutzfunktion und bekommt einen eigenen Test.
5. **Anzeige:** Ein Zeilen-Chip „Prüfung offen“ oder „Geprüft“ mit Zeitpunkt und Person; kein KI- oder Paragraphen-Jargon. Mehrfachbestätigung bleibt außen vor.

## Offene Fragen an den Nutzer

- **Wer darf bestätigen?** Empfehlung: dasselbe Recht wie für den Override (`OVERRIDE_FIELD_STATUS`), damit sich die Rollenmatrix nicht ändert. Alternative: nur Notar und Notarassessor über `FINAL_APPROVAL`, das dann erstmals genutzt würde und `rbac-sql-parity` berührt.
- **Folgt aus „alle Felder geprüft“ ein Gesamtstatus?** Empfehlung: nein in diesem Schritt; eine Sperre von `READY` bis zur Vollprüfung ist ein eigener Entscheid mit Folgen für den Ablauf.

## Nicht enthalten

Prüfplan vor dem Lauf, Playbooks, Export des Prüfvermerks in den Bericht, Sammelbestätigung, Scan-Transkription.

## Wirkung und Nachweis

- Impact: `LOCAL_CODE_ONLY`, bei Bestätigung der Annahme zu `audit_logs.action` ohne Migration.
- Tests (jeder wird ohne die Schutzfunktion rot): Vermerk wird bei geänderten Daten, Quelle oder Status gelöscht; Bestätigung eines Feldes mit Status ungleich `VERIFIED` wird abgelehnt; Akteur stammt aus der Sitzung; Audit-Eintrag `FIELD_CONFIRMED` entsteht genau einmal je Bestätigung.
- Erfolgskriterium: `npm run check` und `npm test` grün, Cockpit-Zeile bei 1440 und 390 px ohne Layout-Sprung.
