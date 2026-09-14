import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Dossier,
  CASE_TYPES,
  FIELD_STATUS,
  CONTRIBUTION_TYPE,
  POWER_OF_REPRESENTATION,
  OVERALL_STATUS,
  STORAGE_TYPES,
} from '@/types/dossier';
import { useVorgangSession } from './useVorgangSession';

const mockDossier: Dossier = {
  caseType: CASE_TYPES.GMBH_GRUENDUNG,
  caseTitle: 'Test Vorgang',
  analysisTimestamp: '2026-09-12T10:00:00Z',
  detectedDocuments: [],
  fields: {
    firma: {
      status: FIELD_STATUS.VERIFIED,
      data: { companyName: 'Muster GmbH', hasNameCheckIhk: true, seatCity: 'Berlin' },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: '' },
      note: '',
    },
    gesellschafter: {
      status: FIELD_STATUS.VERIFIED,
      data: { partners: [], totalCapital: 25000 },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: '' },
      note: '',
    },
    geschaeftsfuehrer: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        managingDirectors: [
          {
            name: 'Max Mustermann',
            powerOfRepresentation: POWER_OF_REPRESENTATION.EINZELVERTRETUNG,
            exemption181Bgb: true,
          },
        ],
        criminalRecordCheckPassed: true,
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: '' },
      note: '',
    },
    stammkapital: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        nominalCapital: 25000,
        contributionType: CONTRIBUTION_TYPE.BAREINLAGE,
        minimumDepositPaid: true,
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: '' },
      note: '',
    },
    unternehmensgegenstand: {
      status: FIELD_STATUS.VERIFIED,
      data: { purposeDescription: 'Software', requiresSpecialPermit: false },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: '' },
      note: '',
    },
  },
  inquiries: [],
  overallStatus: OVERALL_STATUS.READY,
  executiveSummary: 'Test',
};

describe('useVorgangSession', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useVorgangSession());

    expect(result.current.state.files).toEqual([]);
    expect(result.current.state.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
    expect(result.current.state.notes).toBe('');
    expect(result.current.state.dossier).toBeNull();
    expect(result.current.state.isAppending).toBe(false);
  });

  it('updates files, notes and caseType correctly', () => {
    const { result } = renderHook(() => useVorgangSession());

    act(() => {
      result.current.actions.setFiles([
        { name: 'test.pdf', size: 10, type: 'application/pdf', content: 'abc' },
      ]);
      result.current.actions.setNotes('Notizen zum Fall');
      result.current.actions.setCaseType(CASE_TYPES.GMBH_GRUENDUNG);
    });

    expect(result.current.state.files).toHaveLength(1);
    expect(result.current.state.notes).toBe('Notizen zum Fall');
    expect(result.current.state.caseType).toBe(CASE_TYPES.GMBH_GRUENDUNG);
  });

  it('selects document and resets transient upload state', () => {
    const { result } = renderHook(() => useVorgangSession());

    act(() => {
      result.current.actions.setFiles([
        { name: 'test.pdf', size: 10, type: 'application/pdf', content: 'abc' },
      ]);
      result.current.actions.selectDocument('doc-123', mockDossier, 'doc-title-456');
    });

    expect(result.current.state.files).toEqual([]);
    expect(result.current.state.activeDocumentId).toBe('doc-123');
    expect(result.current.state.dossier).toEqual(mockDossier);
    expect(result.current.state.persistenceInfo).toEqual({
      storageType: STORAGE_TYPES.SUPABASE,
      caseNumber: 'doc-title-456',
    });
  });

  it('handles append workflow actions', () => {
    const { result } = renderHook(() => useVorgangSession());

    act(() => {
      result.current.actions.setIsAppending(true);
      result.current.actions.setAppendFiles([
        { name: 'nachtrag.pdf', size: 20, type: 'application/pdf', content: 'def' },
      ]);
      result.current.actions.setAppendNotes('Nachtrag');
    });

    expect(result.current.state.isAppending).toBe(true);
    expect(result.current.state.appendFiles).toHaveLength(1);
    expect(result.current.state.appendNotes).toBe('Nachtrag');

    act(() => {
      result.current.actions.resetAppend();
    });

    expect(result.current.state.isAppending).toBe(false);
    expect(result.current.state.appendFiles).toEqual([]);
    expect(result.current.state.appendNotes).toBe('');
  });
});
