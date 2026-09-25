import {
  DocumentTriageResult,
  formatTriageManifestForPrompt,
  triageDocument,
} from '@/lib/files/document-triage';
import { parseDocumentLayoutStructure } from '@/lib/files/layout-structure-parser';
import {
  PdfStreamType,
  PDF_STREAM_TYPES,
  classifyPdfStream,
} from '@/lib/files/pdf-stream-classifier';
import { extractPdfUnicodeText } from '@/lib/files/pdf-text-extractor';
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
 * Führt serverseitige Dual-Stream-Extraktion (unpdf) für PDFs aus.
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

      if (!extractedText) {
        try {
          const classification = await classifyPdfStream(pdfBuffer);
          streamType = classification.streamType;
          if (classification.hasTextLayer) {
            extractedText = await extractPdfUnicodeText(pdfBuffer);
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

        filePromptParts.push({
          type: 'text',
          text: `\n=== DIREKTER UNICODE-TEXTLAYER AUS "${file.name}"${headerInfo} ===\n${layout.structuredMarkdown}\n=== ENDE TEXTLAYER AUS "${file.name}" ===\n`,
        });
      }

      // 2. Multimodale PDF-Übergabe nur für visuelle Siegel, Stempel, Handschriften (Scans/Hybride)
      //    oder wenn kein Unicode-Text extrahiert werden konnte.
      const requiresVisualInspection =
        streamType !== PDF_STREAM_TYPES.DIGITAL_BORN_TEXT ||
        !extractedText ||
        extractedText.trim().length === 0;

      if (requiresVisualInspection) {
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
          text: `\n[PDF-Dokument: "${file.name}" vollständig als hochpräziser Unicode-Textlayer verarbeitet | Modus: ${streamType}]\n`,
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
