import { describe, it, expect } from 'vitest';
import { verifyExtractionFacts } from '@/lib/ai/verifiable-fact-checker';
import { CASE_TYPES, FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import { ExtractionStageOutput } from '@/types/pipeline';

describe('verifyExtractionFacts', () => {
  const dummyFileSources = [
    {
      fileName: 'Kaufvertrag_Entwurf.pdf',
      textContent:
        'Der Gesamtkaufpreis beträgt 450.000 Euro. Er ist in zwei Raten zu zahlen: erste Rate 250.000 Euro, zweite Rate 200.000 Euro.',
    },
    {
      fileName: 'Grundbuchauszug.pdf',
      textContent: 'Amtsgericht Berlin-Mitte, Blatt 1234. Eigentümerin: Anna Schmidt.',
    },
  ];

  it('passes verification when all snippets exist in the source documents', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'Kaufvertrag Mitte',
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        kaufpreis: {
          data: { value: '450.000 €' },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag_Entwurf.pdf',
            snippet: 'Der Gesamtkaufpreis beträgt 450.000 Euro.',
          },
        },
        eigentuemer: {
          data: { value: 'Anna Schmidt' },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Grundbuchauszug.pdf',
            snippet: 'Eigentümerin: Anna Schmidt.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: dummyFileSources,
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.fields.eigentuemer?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.verificationIssues.length).toBe(0);
  });

  it('downgrades field to NEEDS_REVIEW when snippet is missing/hallucinated in source text', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'Kaufvertrag Mitte',
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        kaufpreis: {
          data: { value: '500.000 €' },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag_Entwurf.pdf',
            snippet: 'Der Kaufpreis beträgt frei erfunden 500.000 Euro.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: dummyFileSources,
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(result.fields.kaufpreis?.note).toContain(
      'Quellen-Snippet nicht wörtlich im Dokument nachweisbar'
    );
    expect(result.verificationIssues.length).toBe(1);
    expect(result.verificationIssues[0]?.fieldKey).toBe('kaufpreis');
  });

  it('tolerates minor whitespace and punctuation differences during snippet verification', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'Kaufvertrag Mitte',
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        kaufpreis: {
          data: { value: '450.000 €' },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag_Entwurf.pdf',
            snippet: 'Der  Gesamtkaufpreis  beträgt  450.000 Euro', // Extra spaces, kein Punkt
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: dummyFileSources,
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.verificationIssues.length).toBe(0);
  });
});
