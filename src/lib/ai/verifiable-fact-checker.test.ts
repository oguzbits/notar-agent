import { describe, it, expect } from 'vitest';
import { findUnsupportedNumbers, verifyExtractionFacts } from '@/lib/ai/verifiable-fact-checker';
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

  it('verifiziert Quellensnippets trotz harter Zeilenumbrüche und Hyphenation im PDF-Dokument', () => {
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
          data: { value: '350.000 €' },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag_Entwurf.pdf',
            snippet: 'Der vereinbarte Gesamtkaufpreis beträgt 350.000 Euro.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: [
        {
          fileName: 'Kaufvertrag_Entwurf.pdf',
          textContent: 'Hierbei gilt: Der vereinbarte Ge-\nsamtkaufpreis beträgt\n350.000 Euro.',
        },
      ],
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.verificationIssues.length).toBe(0);
  });

  it('downgrades field to NEEDS_REVIEW when an extracted number is not supported by source evidence', () => {
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
          data: { amountInFigures: 650000, currency: 'EUR' }, // Halluzinierter Betrag 650.000 €
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag_Entwurf.pdf',
            snippet: 'Der Gesamtkaufpreis beträgt 450.000 Euro.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: dummyFileSources,
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(result.fields.kaufpreis?.note).toContain('Nicht belegte Zahlenangabe');
    expect(
      result.verificationIssues.some((i) => i.reason.includes('Nicht belegte Zahlenangabe'))
    ).toBe(true);
  });

  it('resolves citation via docIndex and backfills canonical fileName', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'Test Fall',
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        kaufpreis: {
          data: { amountInFigures: 450000 },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: '',
            docIndex: 1, // Points to dummyFileSources[0] ('Kaufvertrag_Entwurf.pdf')
            snippet: 'Der Gesamtkaufpreis beträgt 450.000 Euro.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: dummyFileSources,
    });

    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.fields.kaufpreis?.source?.fileName).toBe('Kaufvertrag_Entwurf.pdf');
    expect(result.fields.kaufpreis?.source?.docIndex).toBe(1);
  });

  it('resolves citation when LLM uses short citation key like [DOC-2] or doc_2', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'Test Fall',
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        eigentuemer: {
          data: { name: 'Anna Schmidt' },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: '[DOC-2]', // Refers to 2nd document Grundbuchauszug.pdf
            snippet: 'Eigentümerin: Anna Schmidt.',
          },
        },
      },
    };

    const result = verifyExtractionFacts({
      stageOutput,
      sourceDocuments: dummyFileSources,
    });

    expect(result.fields.eigentuemer?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.fields.eigentuemer?.source?.fileName).toBe('Grundbuchauszug.pdf');
    expect(result.fields.eigentuemer?.source?.docIndex).toBe(2);
  });
});

describe('findUnsupportedNumbers', () => {
  it('returns empty array when all numbers in statement exist in evidence', () => {
    const statement = 'Kaufpreis 450.000 Euro, Grundbuchblatt 1234, Flurstück 108/4';
    const evidence =
      'Der Kaufpreis beträgt 450.000 Euro im Grundbuchblatt 1234 für Flurstück 108/4.';
    expect(findUnsupportedNumbers(statement, evidence)).toEqual([]);
  });

  it('identifies hallucinated numbers that no cited passage contains', () => {
    const statement = 'Kaufpreis 650.000 Euro und Zinsen 18 %';
    const evidence = 'Kaufpreis beträgt 450.000 Euro mit 5 % Zinsen.';
    expect(findUnsupportedNumbers(statement, evidence)).toEqual(['650000', '18']);
  });

  it('recognizes figures across different thousands and decimal formatting', () => {
    expect(findUnsupportedNumbers('450000 Euro', 'Kaufpreis 450.000 Euro')).toEqual([]);
    expect(findUnsupportedNumbers('450 000 Euro', 'Kaufpreis 450.000,00 Euro')).toEqual([]);
  });

  it('accepts unit-converted figures (e.g. thousands to full figure)', () => {
    expect(findUnsupportedNumbers('450.000 Euro', 'Kaufpreis 450 Tsd. Euro')).toEqual([]);
    expect(findUnsupportedNumbers('1,25 Millionen', 'Budget 1 250 000 Euro')).toEqual([]);
  });

  it('handles German and ISO dates consistently', () => {
    expect(findUnsupportedNumbers('Beurkundung am 10.02.2023', 'Datum: 10.02.2023')).toEqual([]);
    expect(findUnsupportedNumbers('Datum 2023-02-10', 'Urkunde vom 10.02.2023')).toEqual([]);
  });
});
