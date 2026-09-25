import type { LanguageModel } from 'ai';
import { GoldenTestCase } from '@/test/eval/golden-dataset';
import { FIELD_STATUS, DOCUMENT_RELIABILITY } from '@/types/dossier';

/**
 * Erzeugt ein synthetisches AI SDK LanguageModel für 0,00 € Offline-Evaluierung
 */
export function createMockEvalModel(testCase: GoldenTestCase): LanguageModel {
  const mockFields: Record<string, unknown> = {};

  for (const [fKey, fExp] of Object.entries(testCase.groundTruth.fields)) {
    const primaryStatus = Array.isArray(fExp.expectedStatus)
      ? fExp.expectedStatus[0]!
      : fExp.expectedStatus;

    const primaryData: Record<string, unknown> = {};
    if (fExp.expectedValues) {
      for (const [k, v] of Object.entries(fExp.expectedValues)) {
        // Nur primitive Alternative-Listen (z. B. [94, 118.2]) auf das erste Element reduzieren,
        // Arrays von Objekten (z. B. entries: [...]) als vollwertige Arrays beibehalten
        if (Array.isArray(v) && typeof v[0] !== 'object') {
          primaryData[k] = v[0];
        } else {
          primaryData[k] = v;
        }
      }
    } else {
      primaryData['name'] = 'Synthetisch';
    }

    mockFields[fKey] = {
      status: primaryStatus,
      data: primaryData,
      source: {
        fileName: testCase.files[0]?.name || 'akte.txt',
        pageNumber: 1,
        snippet: fExp.mustContainInSnippet?.[0] || 'Belegnachweis',
      },
      note: primaryStatus !== FIELD_STATUS.VERIFIED ? 'Prüfvermerk' : '',
    };
  }

  const simulatedResponse = JSON.stringify({
    caseTitle: testCase.name,
    overallStatus: testCase.groundTruth.expectedOverallStatus,
    fields: mockFields,
    detectedDocuments: testCase.files.map((f) => ({
      fileName: f.name,
      documentType: 'Dokument',
      date: '2026-01-01',
      pageCount: 1,
      reliability: DOCUMENT_RELIABILITY.HIGH,
    })),
    inquiries: [],
  });

  return {
    specificationVersion: 'v3',
    provider: 'mock-eval',
    modelId: 'mock-eval-model',
    doGenerate: async () => ({
      text: simulatedResponse,
      content: [{ type: 'text' as const, text: simulatedResponse }],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: { total: 500, noCache: 500, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 200, text: 200, reasoning: 0 },
        raw: {},
      },
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
    doStream: async () => {
      throw new Error('Not implemented for offline eval');
    },
    supportedUrls: {} as never,
  };
}
