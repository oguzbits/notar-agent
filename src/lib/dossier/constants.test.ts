import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import {
  IMMOBILIEN_FIELD_METADATA,
  CASE_TYPE_METADATA_REGISTRY,
  CASE_TYPE_CORE_FIELDS,
  STATUS_LABELS_DE,
} from './constants';

describe('dossier constants', () => {
  it('should have 10 fields defined in IMMOBILIEN_FIELD_METADATA', () => {
    const keys = Object.keys(IMMOBILIEN_FIELD_METADATA);
    expect(keys).toHaveLength(10);
  });

  it('should have 1-based sequential indices for all fields', () => {
    const expectedKeys = [
      'verkaeufer',
      'kaeufer',
      'grundbuch',
      'grundstuecke',
      'kaufpreis',
      'finanzierung',
      'belastungen',
      'mietverhaeltnisse',
      'energieausweis',
      'uebergabe',
    ];

    expectedKeys.forEach((key, idx) => {
      const meta = IMMOBILIEN_FIELD_METADATA[key];
      expect(meta).toBeDefined();
      if (meta) {
        expect(meta.index).toBe(idx + 1);
        expect(meta.title).toBeTruthy();
      }
    });
  });

  it('should register IMMOBILIENKAUF in CASE_TYPE_METADATA_REGISTRY', () => {
    expect(CASE_TYPE_METADATA_REGISTRY[CASE_TYPES.IMMOBILIENKAUF]).toEqual(
      IMMOBILIEN_FIELD_METADATA
    );
  });

  it('should define core fields for IMMOBILIENKAUF', () => {
    const config = CASE_TYPE_CORE_FIELDS[CASE_TYPES.IMMOBILIENKAUF];
    expect(config).toBeDefined();
    if (config) {
      expect(config.partyFields).toContain('verkaeufer');
      expect(config.partyFields).toContain('kaeufer');
      expect(config.objectFields).toContain('kaufpreis');
      expect(config.objectFields).toContain('grundbuch');
    }
  });

  it('should provide German translations for all 4 FieldStatuses', () => {
    expect(STATUS_LABELS_DE.VERIFIED).toBe('Belegt');
    expect(STATUS_LABELS_DE.NEEDS_REVIEW).toBe('Prüfung nötig');
    expect(STATUS_LABELS_DE.OUTDATED).toBe('Veraltet');
    expect(STATUS_LABELS_DE.MISSING).toBe('Fehlt');
  });
});
