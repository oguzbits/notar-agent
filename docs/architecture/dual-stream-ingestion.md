# Dual-Stream Ingestion Pipeline

> **Architektur-Spezifikation:** Verlustfreie Zeichenintegrität & Multimodal Vision  
> **Kernkomponenten:** `src/lib/files/pdf-stream-classifier.ts`, `src/lib/files/pdf-document-parser.ts`, `src/lib/ai/pipeline.ts`

---

## 1. Problemstellung im Notariat

Im Notariat steht **absolute Zeichenpräzision (Zero OCR-Tippfehler)** an oberster Stelle:

- Fehlerhafte Ziffernfolgen bei Kaufpreisen (`1.250.000 €`), Registernummern (`HRB 20459`) oder Flurstücken (`Flur 12, Flurstück 108/4`) führen zu verheerenden Zwischenverfügungen oder Haftungsfällen.
- Gleichzeitig enthalten notarielle Urkundensätze handschriftliche Vermerke, farbige Siegel, Stempel und unvollständige Scans, die reine Text-Parser nicht erfassen können.

---

## 2. Die 3 Stream-Klassen

Eine Byte-Ebene-Introspektion des PDFs klassifiziert jede eingehende Datei deterministisch in einen von drei Modi:

```mermaid
graph TD
    A["Eingehendes PDF / Dokument"] --> B["PDF-Objekt-Introspektion (Byte-Ebene)"]
    B --> C{"Layout- & Stream-Klassifikation"}
    C -->|"1. Digital-Born Text (0 Rasterbilder)"| D["Direct Unicode Text Extraction"]
    C -->|"2. Reines Rasterbild (Scan/Fax, 0 Text)"| E["Multimodal Vision Pipeline"]
    C -->|"3. Hybrid (Text + Siegel/Signaturen)"| F["Dual-Stream Fusion (Text + Bild)"]
    D --> G["Verlustfreier Text-Payload (< 10 ms, Zero Ziffernfehler)"]
    E --> H["High-Res Vision Tokens für Handschrift & Siegel"]
    F --> I["Gleichzeitige Übergabe: Textlayer + Bildverifikation"]
    G & H & I --> J["Notary Extraction & Audit Agent"]
```

1. **Digital-Born PDF (Reiner Textlayer, keine Rasterbilder):**
   - Extrahiert den Unicode-Text direkt verlustfrei (< 10 ms via `@llamaindex/liteparse`, `ocrEnabled: false`).
   - Geometrische Bounding-Box-Korrelation für Formularfelder, Annotationen und Skalen-Zeiger.
   - Keine visuellen Tokens nötig: 100 % Token- und Kostenersparnis.

2. **Scans / Bildträger (Reine Bildseiten, kein nutzbarer Text):**
   - Automatisches Vorab-Rendering vollständiger hochauflösender Seiten-Screenshots als PNG via LiteParse (`extractScreenshots: true`).
   - Übergabe der gerenderten PNG-Seiten direkt als Multimodal-Vision-Part (`image/png`) an das LLM.
   - Maximales Kontextverständnis bei Handschriften, Notarsiegeln und Stempeln ohne fehleranfälliges lokales Tesseract-OCR.

3. **Hybride Dokumente (Digitaler Text + eingescannte Siegel/Signaturen):**
   - **Dual-Stream Fusion mit Objekt-Extraktion:** LiteParse extrahiert den Unicode-Textlayer und isoliert gleichzeitig die eingebetteten Bildobjekte (`extractImages: true`).
   - Jedes Bildobjekt (Siegel, Stempel, Beglaubigungsvermerk) wird mit exakter räumlicher Bounding-Box (`[x, y, width, height]`), Format und Auflösung an das LLM übergeben.
   - Im Textlayer verweist ein Manifest auf die exakte Position: Das LLM prüft den Text digital und verifiziert Siegel/Stempel visuell am genauen Fundort.

4. **Reine Bilddateien (JPG, PNG, WebP):**
   - Überspringen LiteParse/PDFium vollständig und werden direkt nativ als Bild-Payloads an das Vision-LLM übergeben.

---

## 3. Architektur-Status & Ausbaustufen

- **Deterministisches Zitat-Grounding via `diff-match-patch` (Implementiert):**
  Zeichengenaue Verifikation von Beleg-Snippets auf dem PDF-Textlayer zur Vermeidung von Halluzinationen (§ 17 BeurkG Provenance) mit exakter Koordinaten- und Offset-Lokalisierung.
- **Serverless Ingestion Overhaul (B.8):**
  Flache, modulare Zod-Sub-Schemas pro Dokumenttyp (Grundbuch, Energieausweis, Mietlisten) und selektives Windowing für Großakten (> 150 Seiten) bei 100 % Serverless-Kompatibilität.
