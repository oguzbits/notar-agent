---
name: notar-workflow-validator
description: Validiert die juristische und technische Integrität des NotarPartner-Systems. Prüft Schema-Parität der 10 Pflichtfelder, Audit-Trail-Vollständigkeit von Quellenbelegen und Schutzmechanismen bei sensiblen Mandantendaten.
---

# Notar Workflow Validator Skill

Dieser Skill dient als Qualitäts- und Compliance-Gatekeeper für das Projekt **NotarPartner**. Er stellt sicher, dass rechtliche Vorgaben (BeurkG, GwG) und technische Datenmodelle synchron bleiben.

## Prüfdimensionen

### 1. Pflichtfelder-Parität (Schema-Check)

Immobilienkaufverträge erfordern zwingend die Prüfung von 10 Kernfeldern. Der Skill prüft, ob folgende Dateien synchron dieselben Feld-Keys verwenden:

1. `src/types/dossier.ts` (`ImmobilienFieldsSchema`)
2. `src/lib/ai/prompts.ts` (`IMMOBILIEN_EXTRACTION_AGENT_PROMPT` & Reconciler)
3. `src/lib/dossier-helpers.ts` (`extractAllFieldRows`)
4. `src/components/FieldCockpit/UnifiedFieldCockpitTable.tsx`

**Die 10 Pflichtfelder:**

- `verkaeufer`: Verkäufer / Eigentümer lt. Grundbuch & Vertretungsnachweise
- `kaeufer`: Käufer / Gesellschaft & Vertretungsberechtigung
- `grundbuch`: Grundbuchstand (Amtsgericht, Grundbuchbezirk, Band/Blatt)
- `grundstuecke`: Flurstücke, Gemarkungen, Fluren & amtliche Flächen (m²)
- `kaufpreis`: Kaufpreis, Zahlungsbedingungen & Verhandlungsstand
- `finanzierung`: Finanzierungsvollmacht & Grundschuldbestellung
- `belastungen`: Belastungen Abt. II & III (Löschung/Übernahme)
- `mietverhaeltnisse`: Vermietung / Verpachtung / Mietsicherheiten
- `energieausweis`: Gebäudeenergiegesetz (GEG) & Energieausweisdaten
- `uebergabe`: Besitzübergang, Nutzen-Lasten-Wechsel

---

### 2. Audit-Trail-Garantie (Quellenbeleg-Integrität)

Kein Sachverhalt darf ohne Nachweis als rechtssicher gelten:

- Ein Feld darf **nur dann** den Status `VERIFIED` erhalten, wenn `source.fileName`, `source.snippet` und möglichst `source.pageNumber` belegt sind.
- Bei abweichenden Angaben zwischen Parteien muss der Reconciler zwingend `NEEDS_REVIEW` und einen Begründungssatz (`note`) erzeugen.
- Nicht belegte Angaben müssen `MISSING` sein.

---

### 3. Datenschutz & Persistence Guardrails

- Im Fallback-Modus (`in-memory`) dürfen keine Daten ungewollt an externe Dritte abfließen.
- Supabase-Persistierung muss das `Dossier`-Objekt normalisiert speichern.

---

## Validierungs-Befehle

Um die Konsistenz schnell zu prüfen:

```bash
# 1. Type-Check und Build
npm run build

# 2. Reifegrad- und Delta-Tests ausführen
npx vitest run src/lib/dossier-readiness.test.ts src/lib/user-journey-delta.test.ts

# 3. Alle Unit-Tests prüfen
npm test
```
