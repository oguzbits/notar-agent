import {
  DocumentTriageResult,
  formatTriageManifestForPrompt,
  triageDocument,
} from '@/lib/files/document-triage';
import { parseDocumentLayoutStructure } from '@/lib/files/layout-structure-parser';
import { parsePdfDocument } from '@/lib/files/pdf-document-parser';
import {
  PdfStreamType,
  PDF_STREAM_TYPES,
  classifyPdfStream,
} from '@/lib/files/pdf-stream-classifier';
import { DocumentParsedContent } from '@/types/document';
import {
  DOCUMENT_RELIABILITY,
  DetectedDocument,
  CaseType,
  UploadedFilePayload,
} from '@/types/dossier';

export interface AssembledFilePayload extends UploadedFilePayload {
  streamType?: PdfStreamType;
  extractedText?: string;
}
export type { UploadedFilePayload };

export type MultimodalPromptPart =
  | { type: 'text'; text: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string };

export interface AssembleExtractionPromptOptions {
  files: (UploadedFilePayload | AssembledFilePayload)[];
  caseType: CaseType;
  notesSection: string;
  existingDossier?: {
    caseTitle: string;
    overallStatus: string;
    detectedDocuments: DetectedDocument[];
  };
}

/**
 * Baut aus Dokumenten und Notizen deterministisch die multimodalen Teile für den Stufe-1-Prompt.
 * Führt serverseitige Dual-Stream-Extraktion (LiteParse) für PDFs aus.
 */
export async function assembleExtractionPromptParts(
  options: AssembleExtractionPromptOptions
): Promise<MultimodalPromptPart[]> {
  const { files, caseType, notesSection, existingDossier } = options;

  let contextHeader = '';
  if (existingDossier) {
    contextHeader += `=== BEREITS BESTEHENDES VORGANGS-DOSSIER ZUR AKTUALISIERUNG ===
Aktenzeichen / Titel: ${existingDossier.caseTitle}
Bisheriger Gesamtstatus: ${existingDossier.overallStatus}
Bisher erkannte Dokumente: ${existingDossier.detectedDocuments.map((d: DetectedDocument) => `"${d.fileName}" (${d.documentType})`).join(', ')}

ANWEISUNG ZUR AKTUALISIERUNG / NACHREICHUNG (DELTA-MODUS):
1. Prüfe die neu eingereichten Dokumente bzw. Notizen zielgerichtet darauf, ob sie bestehende Lücken (MISSING / NEEDS_REVIEW) schließen.
2. EFFIZIENZ: Gib im "fields"-Objekt AUSSCHLIESSLICH diejenigen Felder aus, die durch die neuen Unterlagen neu verifiziert, korrigiert oder ergänzt werden! Felder, an denen sich durch die neuen Unterlagen nichts ändert, LÄSST DU IM JSON EINFACH WEG. Unser System übernimmt bisherige Stände automatisch.
3. Führe die Liste der erkannten Dokumente (detectedDocuments) fort (vorherige Dokumente + neu eingereichte Dokumente).
4. Aktualisiere offene Nachforderungen (inquiries) – erledigte Punkte entfernen oder als resolved markieren.
\n`;
  }

  contextHeader += `Führe die Zuarbeit streng gemäß deinen Richtlinien durch:
- Setze caseType auf "${caseType}".
- Identifiziere jedes Dokument mit Datum und Verlässlichkeit (${DOCUMENT_RELIABILITY.HIGH}, ${DOCUMENT_RELIABILITY.MEDIUM}, ${DOCUMENT_RELIABILITY.LOW}, ${DOCUMENT_RELIABILITY.OBSOLETE}, ${DOCUMENT_RELIABILITY.UNRELATED}).
- Prüfe jedes der 10 Pflichtfelder mit vollständigem Audit Trail (fileName + snippet).
- Extrahiere alle im Aktenbestand nachweisbaren Datenpunkte sachlich, vollständig und präzise.
- Setze den Status (VERIFIED, NEEDS_REVIEW, OUTDATED, MISSING) objektiv anhand der vorliegenden Belege und Gültigkeiten.
- Erstelle strukturierte Nachforderungen an zuständige Beteiligte ausschließlich für echte, unverzichtbare Lücken.

${notesSection}${
    files.length > 0
      ? 'Eingereichte Dateien im Vorgang:\n' +
        files
          .map(
            (f, i) =>
              `[Dokument #${i + 1}]: "${f.name}" (${f.type || 'unbekannt'}, ${Math.round(f.size / 1024)} KB)`
          )
          .join('\n') +
        '\n\n--- DOKUMENTENINHALTE (ALLE DATEIEN SORGFÄLTIG UND VOLLSTÄNDIG PRÜFEN) ---\n'
      : ''
  }`;

  const triageList: DocumentTriageResult[] = [];
  const filePromptParts: MultimodalPromptPart[] = [];

  for (const file of files) {
    if (file.isBase64 && file.type.startsWith('image/')) {
      const rawBase64 = (file.content || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      filePromptParts.push({
        type: 'file',
        data: rawBase64,
        mediaType: file.type,
        filename: file.name,
      });
      filePromptParts.push({
        type: 'text',
        text: `\n[Obiges Bild gehört zu Datei: "${file.name}"]\n`,
      });
      triageList.push(
        triageDocument({
          fileName: file.name,
        })
      );
    } else if (
      file.isBase64 &&
      (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    ) {
      const rawBase64 = (file.content || '').replace(/^data:application\/pdf;base64,/, '');
      const pdfBuffer = Buffer.from(rawBase64, 'base64');

      // Serverseitige Dual-Stream-Analyse: Entlastet den Client vollständig von unpdf / PDF.js
      const assembledFile = file as Partial<AssembledFilePayload>;
      let streamType: PdfStreamType = assembledFile.streamType || PDF_STREAM_TYPES.SCANNED_IMAGE;
      let extractedText: string | undefined = assembledFile.extractedText;
      let parsedImages: NonNullable<DocumentParsedContent['extractedImages']> = [];
      let parsedScreenshots: NonNullable<DocumentParsedContent['pageScreenshots']> = [];

      if (!extractedText) {
        try {
          const classification = await classifyPdfStream(pdfBuffer);
          streamType = classification.streamType;

          // Screenshots rendern, wenn es sich um reine Scans handelt (kein nutzbarer Text)
          const needsScreenshots = streamType === PDF_STREAM_TYPES.SCANNED_IMAGE;

          // LiteParse parst den Text und extrahiert eingebettete Bildausschnitte (Siegel/Stempel)
          const parsedDoc = await parsePdfDocument(pdfBuffer, {
            extractImages: true,
            extractScreenshots: needsScreenshots,
          });

          if (parsedDoc.hasTextLayer) {
            extractedText = parsedDoc.markdown;
          }
          if (parsedDoc.extractedImages && parsedDoc.extractedImages.length > 0) {
            parsedImages = parsedDoc.extractedImages;
          }
          if (parsedDoc.pageScreenshots && parsedDoc.pageScreenshots.length > 0) {
            parsedScreenshots = parsedDoc.pageScreenshots;
          }
        } catch (err: unknown) {
          console.warn(
            '[payload-assembler] Serverseitige PDF-Introspektion fehlgeschlagen für Datei:',
            file.name,
            err
          );
        }
      }

      // ADAPTIVE MULTIMODAL INGESTION:
      // 1. Unicode-Textlayer mit Layout-Strukturierung (Markdown-Tabellen, Klauseln) injizieren
      if (extractedText && extractedText.trim()) {
        const layout = parseDocumentLayoutStructure(extractedText);
        const headerInfo = layout.hasStructuredBlocks
          ? ` (LAYOUT-BEWUSST STRUKTURIERT IN ${layout.blocks.length} LOGISCHE BLÖCKE/TABELLEN)`
          : '';

        let markdownContent = layout.structuredMarkdown;

        // Falls eingebettete Bilder vorhanden sind, Kontextangaben mit Koordinaten anhängen
        if (parsedImages.length > 0) {
          const imageManifest = parsedImages
            .map(
              (img, idx) =>
                `- Bild #${idx + 1} (${img.id}): Seite ${img.pageNumber} bei Position [x: ${Math.round(img.bbox.x)}, y: ${Math.round(img.bbox.y)}, Breite: ${Math.round(img.bbox.width)}, Höhe: ${Math.round(img.bbox.height)}] (${img.width}x${img.height}px)`
            )
            .join('\n');

          markdownContent += `\n\n### In "${file.name}" erkannte grafische Elemente & Stempel/Siegel:\n${imageManifest}\n`;
        }

        filePromptParts.push({
          type: 'text',
          text: `\n=== DIREKTER UNICODE-TEXTLAYER AUS "${file.name}"${headerInfo} ===\n${markdownContent}\n=== ENDE TEXTLAYER AUS "${file.name}" ===\n`,
        });
      }

      // 2. Multimodale Übergabe:
      // A) Wenn eingebettete Bilder (Siegel, Stempel, Signaturen) extrahiert wurden -> gezielt als Bilder übergeben
      if (parsedImages.length > 0) {
        let imgIdx = 0;
        for (const img of parsedImages) {
          imgIdx++;
          filePromptParts.push({
            type: 'file',
            data: img.base64Data,
            mediaType: img.mediaType,
            filename: `${file.name}_img_${img.pageNumber}_${imgIdx}.${img.format}`,
          });
          filePromptParts.push({
            type: 'text',
            text: `\n[Obiges Bild gehört zu: "${file.name}" | Seite ${img.pageNumber} | Koordinaten: x: ${Math.round(img.bbox.x)}, y: ${Math.round(img.bbox.y)}, w: ${Math.round(img.bbox.width)}, h: ${Math.round(img.bbox.height)}]\n`,
          });
        }
      }

      // B) Bei reinen Scans (ohne Text): Ganze Seiten als PNG-Screenshots übergeben
      if (streamType === PDF_STREAM_TYPES.SCANNED_IMAGE) {
        if (parsedScreenshots.length > 0) {
          for (const shot of parsedScreenshots) {
            const pureBase64 = shot.base64Png.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
            filePromptParts.push({
              type: 'file',
              data: pureBase64,
              mediaType: 'image/png',
              filename: `${file.name}_seite_${shot.pageNum}.png`,
            });
          }
          filePromptParts.push({
            type: 'text',
            text: `\n[Obige gerenderte Seiten-Screenshots gehören zum Scan: "${file.name}"]\n`,
          });
        } else {
          // Fallback falls Screenshot-Rendering fehlschlug
          filePromptParts.push({
            type: 'file',
            data: rawBase64,
            mediaType: 'application/pdf',
            filename: file.name,
          });
          filePromptParts.push({
            type: 'text',
            text: `\n[Obiges PDF-Dokument: "${file.name}" | Modus: ${streamType}]\n`,
          });
        }
      } else if (
        parsedImages.length === 0 &&
        (!extractedText || extractedText.trim().length === 0)
      ) {
        // Fallback: Weder Text noch Bilder extrahiert -> Original PDF übergeben
        filePromptParts.push({
          type: 'file',
          data: rawBase64,
          mediaType: 'application/pdf',
          filename: file.name,
        });
        filePromptParts.push({
          type: 'text',
          text: `\n[Obiges PDF-Dokument: "${file.name}" | Modus: ${streamType}]\n`,
        });
      } else {
        filePromptParts.push({
          type: 'text',
          text: `\n[PDF-Dokument: "${file.name}" erfolgreich verarbeitet | Modus: ${streamType} | Eingebettete Grafiken: ${parsedImages.length}]\n`,
        });
      }

      triageList.push(
        triageDocument({
          fileName: file.name,
          textContent: extractedText || '',
        })
      );
    } else if (file.content) {
      filePromptParts.push({
        type: 'text',
        text: `\n=== START DATEI: "${file.name}" ===\n${file.content}\n=== ENDE DATEI: "${file.name}" ===\n`,
      });
      triageList.push(
        triageDocument({
          fileName: file.name,
          textContent: file.content,
        })
      );
    } else {
      filePromptParts.push({
        type: 'text',
        text: `\n=== DATEI: "${file.name}" (Metadaten vorhanden) ===\n`,
      });
      triageList.push(
        triageDocument({
          fileName: file.name,
        })
      );
    }
  }

  const triageManifest = formatTriageManifestForPrompt(triageList);
  if (triageManifest) {
    contextHeader = `${triageManifest}\n${contextHeader}`;
  }

  return [
    {
      type: 'text',
      text: contextHeader,
    },
    ...filePromptParts,
  ];
}
