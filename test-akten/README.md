# Notar Agent Enterprise Testakten & Real-World Fixtures

> **Zweck & Invariante (§ 203 StGB / DSGVO):**  
> Alle Dateien in diesem Verzeichnis sind **synthetisch generierte, datenschutzkonforme Referenzakten**. Sie enthalten keinerlei echte Mandanten- oder Urkundendaten, bilden jedoch physikalisch exakte Bedingungen des notariellen Alltags nach (Multimodalität, Handschriften, Scan-Artefakte, unvollständige Urkunden).

---

## 📂 Struktur & Semantische Vorgangs-Matrix

Die Akten sind nach **Vorgängen (Aktenordnern)** gegliedert. Innerhalb der Ordner tragen alle Dateien **völlig neutrale Kanzleinamen**, um jegliche Vorab-Information (Prompt-Spoiling) für Sprach- und Vision-Modelle auszuschließen.

| Vorgangsordner                               | Datei(en)                                                                              | Juristischer & Technischer Prüfzweck                                                                                                                               | Erwartetes KI-Ergebnis (Ground Truth)                                                                                               |
| :------------------------------------------- | :------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **`fall-01-ausweis-pruefung/`**              | • `Personalausweis_Scan.png` (verwackelt)<br>• `Personalausweis_Referenz.png` (scharf) | **Stress-Test Multimodalität:** Erkennt die KI Unleserlichkeit ehrlich (`NEEDS_REVIEW`), statt Ausweisdaten zu halluzinieren?                                      | **Scan:** `NEEDS_REVIEW` (Warnung: Ausweis unleserlich)<br>**Referenz:** `VERIFIED` (Vollständige Extraktion)                       |
| **`fall-02-grundbuch-vollstaendigkeit/`**    | • `Grundbuchauszug_Lindenthal.png`<br>• `Grundbuchauszug_Lindenthal.pdf`               | **Vollständigkeitsprüfung & § 21 BeurkG:** Erkennt die KI, dass Seite 2 (Abteilung I Eigentümer) im Auszug fehlt?                                                  | **Felder `verkaeufer` & `grundbuch`:** `NEEDS_REVIEW`<br>Gesperrt für Beurkundungsreife gem. § 21 BeurkG.                           |
| **`fall-03-vertragsaenderung-handschrift/`** | • `Kaufvertrag_Scan.png`<br>• `Kaufvertrag_Auszug.pdf`                                 | **Handschriften- & Streichungs-Erkennung:** Priorisiert das Modell die notarielle handschriftliche Randkorrektur über dem Drucktext?                               | **Feld `kaufpreis`:** `425.000,00 EUR` (NICHT 450.000 €!)<br>Status: `NEEDS_REVIEW` mit Prüfhinweis zur handschriftlichen Änderung. |
| **`fall-04-standard-urkunde/`**              | • `Kaufvertrag_Koeln_UR89.pdf`                                                         | **Happy-Path Baseline:** Vollständige, fehlerfreie notarielle Urkunde (Maria Fischer / Jan Schmidt, 550.000 €).                                                    | **Gesamtstatus:** `READY`<br>Alle Pflichtfelder `VERIFIED`, 0 Beanstandungen.                                                       |
| **`fall-05-energieausweis-wohngebaeude/`**   | • `Energieausweis_Beethovenstr.pdf`                                                    | **GEG-Pflichtfeldprüfung (§§ 79 ff. GEG):** Extraktion aus amtlichem Bundesmuster (Bedarf 78,5 kWh/m²a, Effizienzklasse C, gültig bis 2034).                       | **Feld `energieausweis`:** `VERIFIED`<br>Klasse: C, Kennwert: 78.5, isExpired: false.                                               |
| **`fall-06-energieausweis-prueffrist/`**     | • `Energieausweis_AachenerStr.pdf`                                                     | **Mathematische Fristfallen-Prüfung (§ 80 GEG):** Neutrales Datum `10.02.2023`. Erkennt die KI eigenständig das Fristende ohne visuelle Spoiler?                   | **Feld `energieausweis`:** `NEEDS_REVIEW`<br>isExpired: true, Warnung: _Energieausweis abgelaufen_.                                 |
| **`fall-07-gewerbe-energieausweis/`**        | • `Energieausweis_Hohenzollernring.pdf`                                                | **Gewerbe-Immobilientest (Nichtwohngebäude):** Getrennte Kennwerte für Wärme (94 kWh) und Strom (42,5 kWh) ohne Effizienzklasse A–H.                               | **Feld `energieausweis`:** `VERIFIED`<br>Erkennt Gewerbestruktur nach GEG.                                                          |
| **`fall-08-mieterliste-handschrift/`**       | • `Mieterliste_Objekt_Lindenthal.pdf`                                                  | **MFH-Mieterlisten & Handschriften-Arithmetik:** Erkennt die KI 28 gedruckte + 2 handschriftliche Mieter (Kowalski & Öztürk) sowie die korrekte Gesamt-Nettomiete? | **Ergebnis:** 30 Parteien erkannt.<br>**Miete Netto mtl.:** `19.125,00 EUR`<br>**Miete Netto jährl.:** `229.500,00 EUR`             |
| **`vorlage-muster/`**                        | • `GEG24_Wohngebaeude_DL.pdf`<br>• `GEG24_Nichtwohngebaeude_DL.pdf`                    | **Unbefüllte Master-Vorlagen:** Originale 5-seitige Blanko-PDFs des Bundesministeriums (GEG 2024).                                                                 | Dienen als Kopiervorlage für künftige Testfall-Generierungen.                                                                       |

---

## 🛠️ Regenerierung der Testakten

Alle Dateien können jederzeit deterministisch neu erzeugt werden:

```bash
# 1. Personalausweise (scharf & unscharf) in fall-01 neu erzeugen
npx tsx scripts/fixtures/generate-authentic-id-card.ts

# 2. Amtlichen Grundbuchauszug in fall-02 neu rendern
npx tsx scripts/fixtures/generate-authentic-grundbuch-scan.ts

# 3. Urkunde mit handschriftlicher Notiz in fall-03 neu rendern
npx tsx scripts/fixtures/generate-authentic-handwritten-scan.ts

# 4. Authentische MFH-Mieterliste (30 Einheiten, handschriftliche Ergänzung) in fall-08 erzeugen
npx tsx scripts/fixtures/generate-authentic-mieterliste-scan.ts

# Hinweis zu fall-05, fall-06 und fall-07 (Energieausweise):
# Die offiziellen Bundesmuster-PDFs sind fertig ausgefüllte, kuratierte Master-Vorlagen.
# Sie werden nicht programmatisch überschrieben, um die millimetergenaue Formularausrichtung zu bewahren.
```

---

## 🤖 Anweisungen für Agenten

1. **Keine echten Mandantendaten einmischen:** Verwende zum Testen, Benchmarking oder für Demos ausschließlich diese Dateien oder synthetische Generatoren aus `src/test/fixtures/`.
2. **Neutrale Dateinamen beibehalten:** Ändere die Dateinamen niemals in verräterische Bezeichnungen (wie `abgelaufen.pdf` oder `unscharf.png`), um die Validität der Benchmarks nicht zu zerstören.
3. **Erwartungswerte respektieren:** Ändere nicht die Soll-Werte (Ground Truth), ohne Rücksprache zu halten – sie bilden die Grundlage für die Regressionstests in `src/test/eval/golden-dataset.ts` und `npm run eval`.
