import { describe, it, expect } from 'vitest';
import { CASE_TYPES, DOCUMENT_RELIABILITY, OVERALL_STATUS } from '@/types/dossier';
import { assembleExtractionPromptParts, UploadedFilePayload } from './payload-assembler';

describe('payload-assembler', () => {
  it('assembles base prompt with context and files list', async () => {
    const files: UploadedFilePayload[] = [
      {
        name: 'anschreiben.txt',
        type: 'text/plain',
        size: 1024,
        content: 'Sehr geehrter Notar, anbei die Unterlagen.',
      },
    ];

    const parts = await assembleExtractionPromptParts({
      files,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notesSection: 'Hinweis: Vorgang eilt.\n',
    });

    expect(parts).toHaveLength(2);
    const firstPart = parts[0];
    expect(firstPart?.type).toBe('text');
    expect((firstPart as { text: string }).text).toContain(
      `Setze caseType auf "${CASE_TYPES.IMMOBILIENKAUF}"`
    );
    expect((firstPart as { text: string }).text).toContain('Hinweis: Vorgang eilt.');
    expect((firstPart as { text: string }).text).toContain('[Dokument #1]: "anschreiben.txt"');

    // Textdatei-Inhalt
    const secondPart = parts[1];
    expect(secondPart?.type).toBe('text');
    expect((secondPart as { text: string }).text).toContain(
      '=== START DATEI: "anschreiben.txt" ==='
    );
    expect((secondPart as { text: string }).text).toContain(
      'Sehr geehrter Notar, anbei die Unterlagen.'
    );
  });

  it('handles image uploads and strips base64 data URLs', async () => {
    const rawImageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const files: UploadedFilePayload[] = [
      {
        name: 'personalausweis.jpg',
        type: 'image/jpeg',
        size: 2048,
        isBase64: true,
        content: `data:image/jpeg;base64,${rawImageBase64}`,
      },
    ];

    const parts = await assembleExtractionPromptParts({
      files,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notesSection: '',
    });

    expect(parts).toHaveLength(3);
    // Header
    const part0 = parts[0];
    expect(part0?.type).toBe('text');

    // Image file part
    const part1 = parts[1];
    expect(part1?.type).toBe('file');
    const filePart = part1 as { type: 'file'; data: string; mediaType: string; filename?: string };
    expect(filePart.mediaType).toBe('image/jpeg');
    expect(filePart.data).toBe(rawImageBase64);
    expect(filePart.filename).toBe('personalausweis.jpg');

    // Image label part
    const part2 = parts[2];
    expect(part2?.type).toBe('text');
    expect((part2 as { text: string }).text).toContain('personalausweis.jpg');
  });

  it('performs dual-stream PDF processing (Unicode text layer + multimodal PDF file part)', async () => {
    // Synthetisches PDF mit Textlayer
    const syntheticTextPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
(Kaufvertrag Kaufpreis EUR 500.000 Flurstueck 42) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`;
    const pdfBase64 = Buffer.from(syntheticTextPdf, 'utf-8').toString('base64');

    const files: UploadedFilePayload[] = [
      {
        name: 'kaufvertrag.pdf',
        type: 'application/pdf',
        size: 4096,
        isBase64: true,
        content: `data:application/pdf;base64,${pdfBase64}`,
      },
    ];

    const parts = await assembleExtractionPromptParts({
      files,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notesSection: '',
    });

    // Bei digital-born Text-PDFs wird kein redundanter base64-File-Part erzeugt (Token-Optimierung)
    const filePart = parts.find(
      (p) => p.type === 'file' && (p as { mediaType?: string }).mediaType === 'application/pdf'
    );
    expect(filePart).toBeUndefined();

    const textParts = parts.filter((p) => p.type === 'text') as { type: 'text'; text: string }[];
    const hasTextLayer = textParts.some((p) => p.text.includes('Flurstueck 42'));
    expect(hasTextLayer).toBe(true);

    const hasStreamLabel = textParts.some((p) => p.text.includes('kaufvertrag.pdf'));
    expect(hasStreamLabel).toBe(true);
  });

  it('attaches multimodal file part for scanned PDFs without readable text layer', async () => {
    // Leeres PDF ohne Textlayer
    const scannedPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj
trailer << /Root 1 0 R >>
%%EOF`;
    const pdfBase64 = Buffer.from(scannedPdf, 'utf-8').toString('base64');

    const files: UploadedFilePayload[] = [
      {
        name: 'scan_urkunde.pdf',
        type: 'application/pdf',
        size: 2048,
        isBase64: true,
        content: `data:application/pdf;base64,${pdfBase64}`,
      },
    ];

    const parts = await assembleExtractionPromptParts({
      files,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notesSection: '',
    });

    const filePart = parts.find(
      (p) => p.type === 'file' && (p as { mediaType?: string }).mediaType === 'application/pdf'
    );
    expect(filePart).toBeDefined();
  });

  it('includes existing dossier instructions when in delta mode', async () => {
    const parts = await assembleExtractionPromptParts({
      files: [],
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      notesSection: '',
      existingDossier: {
        caseTitle: 'Vorgang Schmidt Az 123/26',
        overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
        detectedDocuments: [
          {
            fileName: 'vorvertrag.pdf',
            documentType: 'Entwurf',
            date: '2026-01-01',
            pageCount: 2,
            reliability: DOCUMENT_RELIABILITY.HIGH,
          },
        ],
      },
    });

    expect(parts).toHaveLength(1);
    const headerText = (parts[0] as { text: string }).text;
    expect(headerText).toContain('=== BEREITS BESTEHENDES VORGANGS-DOSSIER ZUR AKTUALISIERUNG ===');
    expect(headerText).toContain('Vorgang Schmidt Az 123/26');
    expect(headerText).toContain('"vorvertrag.pdf" (Entwurf)');
    expect(headerText).toContain('ANWEISUNG ZUR AKTUALISIERUNG / NACHREICHUNG (DELTA-MODUS)');
  });
});
