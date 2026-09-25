import { describe, it, expect } from 'vitest';
import { verifyExtractionFacts } from '@/lib/ai/verifiable-fact-checker';
import { CASE_TYPES, CONTRIBUTION_TYPE, FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
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

  it('detects mathematical discrepancy between stated Kaufpreis and payment rates in raw text snippet', () => {
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
          data: {
            amountInFigures: 500000,
            amountInWords: 'fünfhunderttausend Euro',
            currency: 'EUR',
          },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag_Entwurf.pdf',
            snippet:
              'Kaufpreis 500.000 Euro. Erste Rate 200.000 Euro, zweite Rate 200.000 Euro fällig am 01.12.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: [
        {
          fileName: 'Kaufvertrag_Entwurf.pdf',
          textContent:
            'Kaufpreis 500.000 Euro. Erste Rate 200.000 Euro, zweite Rate 200.000 Euro fällig am 01.12.',
        },
      ],
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(result.fields.kaufpreis?.note).toContain('Rechnerische Kaufpreisdiskrepanz');
    expect(result.verificationIssues.some((i) => i.fieldKey === 'kaufpreis')).toBe(true);
  });

  it('detects capital discrepancy when sum of GmbH partner shares does not equal nominal capital', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'GmbH Gründung',
      caseType: CASE_TYPES.GMBH_GRUENDUNG,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        stammkapital: {
          data: {
            nominalCapital: 25000,
            contributionType: CONTRIBUTION_TYPE.BAREINLAGE,
            minimumDepositPaid: true,
          },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Gruendungsurkunde.pdf',
            snippet: 'Stammkapital 25.000 Euro',
          },
        },
        gesellschafter: {
          data: {
            partners: [
              { name: 'Dr. Anna Schmidt', shareAmount: 10000, sharePercent: 40 },
              { name: 'Jan Becker', shareAmount: 10000, sharePercent: 40 },
            ],
            totalCapital: 20000,
          },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Gruendungsurkunde.pdf',
            snippet: 'Gesellschafter Anna Schmidt und Jan Becker',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: [
        {
          fileName: 'Gruendungsurkunde.pdf',
          textContent:
            'Stammkapital 25.000 Euro. Gesellschafter Anna Schmidt und Jan Becker mit Anteilen.',
        },
      ],
    });

    expect(result.fields.gesellschafter?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(result.fields.gesellschafter?.note).toContain('Rechnerische Kapitaldiskrepanz');
    expect(result.verificationIssues.some((i) => i.fieldKey === 'gesellschafter')).toBe(true);
  });
});
