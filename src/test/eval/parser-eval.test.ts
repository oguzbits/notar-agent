import { describe, expect, it } from 'vitest';
import { parsePdfDocument } from '@/lib/files/pdf-document-parser';
import { GOLDEN_DATASET } from '@/test/eval/golden-dataset';
import { ParserEvalResult } from '@/types/eval';

describe('Layer 1 Evaluation: LiteParse Ingestion & Bounding-Box Benchmark', () => {
  const casesWithParserTruth = GOLDEN_DATASET.filter((tc) => tc.parserGroundTruth);

  it('erkennt alle definierten Testakten mit Parser-Ground-Truth', () => {
    expect(casesWithParserTruth.length).toBeGreaterThanOrEqual(3);
  });

  for (const testCase of casesWithParserTruth) {
    it(`misst Parser-Recall und Bounding-Box Alignment für ${testCase.id}`, async () => {
      const pdfFile = testCase.files.find(
        (f) => f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf'))
      );
      expect(pdfFile).toBeDefined();

      if (!pdfFile || !pdfFile.content || !testCase.parserGroundTruth) return;

      const rawContent = pdfFile.content;
      const base64Data = rawContent.includes(';base64,')
        ? (rawContent.split(';base64,')[1] ?? '')
        : rawContent;
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      const startTime = performance.now();

      // Führe LiteParse-Extraktion isoliert aus
      const parsed = await parsePdfDocument(pdfBuffer);
      const parseDurationMs = performance.now() - startTime;

      const extractedMarkdown = parsed.markdown;

      // 1. Token Recall Prüfung (kritische Zahlen, Klassen, Adressen)
      const missingTokens: string[] = [];
      for (const requiredToken of testCase.parserGroundTruth.requiredTokens) {
        if (!extractedMarkdown.includes(requiredToken)) {
          missingTokens.push(requiredToken);
        }
      }

      const totalTokensExpected = testCase.parserGroundTruth.requiredTokens.length;
      const matchedTokensCount = totalTokensExpected - missingTokens.length;
      const tokenRecallRate = Number(((matchedTokensCount / totalTokensExpected) * 100).toFixed(1));

      // 2. Bounding-Box / Geometrie Correlation Prüfung
      const expectedCorrelations = testCase.parserGroundTruth.expectedCorrelations || [];
      const missingCorrelations: string[] = [];

      for (const corr of expectedCorrelations) {
        const lines = extractedMarkdown.split('\n');
        const matchedLine = lines.find(
          (l) =>
            l.toLowerCase().includes(corr.labelSubstring.toLowerCase()) &&
            (l.endsWith(`: ${corr.expectedValue}`) || l.includes(`: ${corr.expectedValue}`))
        );
        if (!matchedLine) {
          missingCorrelations.push(
            `Label "${corr.labelSubstring}" -> Wert "${corr.expectedValue}"`
          );
        }
      }

      const totalCorrelationsExpected = expectedCorrelations.length;
      const matchedCorrelationsCount = totalCorrelationsExpected - missingCorrelations.length;
      const correlationRate =
        totalCorrelationsExpected > 0
          ? Number(((matchedCorrelationsCount / totalCorrelationsExpected) * 100).toFixed(1))
          : 100.0;

      const passed =
        missingTokens.length === 0 &&
        missingCorrelations.length === 0 &&
        (testCase.parserGroundTruth.maxAllowedParseMs
          ? parseDurationMs <= testCase.parserGroundTruth.maxAllowedParseMs
          : true);

      const result: ParserEvalResult = {
        caseId: testCase.id,
        fileName: pdfFile.name,
        totalTokensExpected,
        matchedTokensCount,
        tokenRecallRate,
        requiredCorrelationsExpected: totalCorrelationsExpected,
        matchedCorrelationsCount,
        correlationRate,
        parseDurationMs: Math.round(parseDurationMs),
        passed,
        missingTokens,
        missingCorrelations,
      };

      // Logging für Transparenz und Messbarkeit
      console.log(
        `\n📊 [LITEPARSE BENCHMARK - ${testCase.id}]:\n` +
          `  - Datei: ${result.fileName}\n` +
          `  - Text-Recall: ${result.tokenRecallRate}% (${result.matchedTokensCount}/${result.totalTokensExpected})\n` +
          `  - Bounding-Box Alignment: ${result.correlationRate}% (${result.matchedCorrelationsCount}/${result.requiredCorrelationsExpected})\n` +
          `  - Latenz: ${result.parseDurationMs} ms (PDFium native)\n` +
          (missingTokens.length > 0 ? `  - Fehlende Tokens: ${missingTokens.join(', ')}\n` : '') +
          (missingCorrelations.length > 0
            ? `  - Fehlende Zuordnungen: ${missingCorrelations.join('; ')}\n`
            : '')
      );

      expect(missingTokens).toEqual([]);
      expect(missingCorrelations).toEqual([]);
      expect(result.tokenRecallRate).toBe(100.0);
      expect(result.correlationRate).toBe(100.0);
    });
  }
});
