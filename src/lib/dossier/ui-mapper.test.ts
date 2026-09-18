import { describe, it, expect } from 'vitest';
import { generatePruefberichtText } from '@/lib/export';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { AUDIT_ACTIONS } from '@/types/audit';
import { Dossier, FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import {
  cleanSourceFileName,
  parseSourceLocations,
  extractFieldObservations,
  extractAllFieldRows,
} from './ui-mapper';

function createStubDossier(): Dossier {
  return createTestImmobilienDossier({
    caseTitle: 'Test Vorgang',
    analysisTimestamp: '2026-09-12T00:00:00.000Z',
    overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
    executiveSummary: '2 Felder erfordern Prüfung.',
    fieldStatusMap: {
      kaeufer: FIELD_STATUS.NEEDS_REVIEW,
      energieausweis: FIELD_STATUS.OUTDATED,
    },
    fields: {
      kaeufer: {
        actionRequired: 'Handelsregister anfordern',
        note: 'HRB Auszug fehlt',
        source: { fileName: 'angebot.pdf + Notiz #1', pageNumber: 1, snippet: 'Käuferangebot' },
      },
      energieausweis: {
        actionRequired: 'Neuen Ausweis anfordern',
        note: 'Energieausweis abgelaufen',
        data: {
          validUntil: '2020-01-01',
          isExpired: true,
        },
      },
    },
  });
}

describe('UI Mapper & Formatting Services', () => {
  it('cleanSourceFileName should trim and normalize input', () => {
    expect(cleanSourceFileName('  urkunde.pdf  ')).toBe('urkunde.pdf');
    expect(cleanSourceFileName('')).toBe('');
  });

  it('parseSourceLocations should handle combined and separated sources with deduplication', () => {
    const single = parseSourceLocations({
      fileName: 'urkunde.pdf',
      pageNumber: 3,
      snippet: 'Text',
    });
    expect(single).toEqual([{ fileName: 'urkunde.pdf', pageNumber: 3, snippet: 'Text' }]);

    const combined = parseSourceLocations({
      fileName: 'Doc1.pdf + Doc2.pdf; Doc1.pdf',
      pageNumber: 0,
      snippet: 'Ausschnitt',
    });
    expect(combined).toHaveLength(2);
    expect(combined[0]?.fileName).toBe('Doc1.pdf');
    expect(combined[1]?.fileName).toBe('Doc2.pdf');
  });

  it('extractFieldObservations should return only problematic fields (non-verified)', () => {
    const dossier = createStubDossier();
    const obs = extractFieldObservations(dossier);
    expect(obs).toHaveLength(2);
    expect(obs[0]?.fieldKey).toBe('kaeufer');
    expect(obs[0]?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(obs[0]?.actionRequired).toBe('Handelsregister anfordern');
    expect(obs[1]?.fieldKey).toBe('energieausweis');
    expect(obs[1]?.status).toBe(FIELD_STATUS.OUTDATED);
  });

  it('extractAllFieldRows should return all 10 fields in proper order', () => {
    const dossier = createStubDossier();
    const rows = extractAllFieldRows(dossier);
    expect(rows).toHaveLength(10);
    expect(rows[0]?.fieldKey).toBe('verkaeufer');
    expect(rows[0]?.fieldIndex).toBe(1);
    expect(rows[9]?.fieldKey).toBe('uebergabe');
    expect(rows[9]?.fieldIndex).toBe(10);
  });

  it('generatePruefberichtText should produce a complete textual audit report', () => {
    const dossier = createStubDossier();
    const report = generatePruefberichtText(dossier, {
      history: [
        {
          action: AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
          timestamp: '2026-09-14T10:00:00Z',
          actor: 'Notar Dr. Test',
          currentHash: 'a'.repeat(64),
          details: {
            override: {
              fieldKey: 'verkaeufer',
              newStatus: FIELD_STATUS.VERIFIED,
              reason: 'Erbschein vorgelegt',
            },
          },
        },
      ],
      integrityValid: true,
    });
    expect(report).toContain('=== PRÜFBERICHT & FESTSTELLUNGEN (§ 17 ff. BeurkG) ===');
    expect(report).toContain('Vorgang: Test Vorgang');
    expect(report).toContain('[2] Käufer [Prüfung nötig]: HRB Auszug fehlt');
    expect(report).toContain('[9] Energieausweis [Veraltet]: Energieausweis abgelaufen');
    expect(report).toContain('=== REVISIONSSICHERER AUDIT-TRAIL (HASH-CHAINING § 17 BeurkG) ===');
    expect(report).toContain('Mathematisch verifiziert (Lückenlos)');
    expect(report).toContain('Freigabebegründung (verkaeufer -> VERIFIED): "Erbschein vorgelegt"');
  });
});
