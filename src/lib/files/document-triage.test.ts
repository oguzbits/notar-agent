import { describe, it, expect } from 'vitest';
import { DOCUMENT_RELIABILITY } from '@/types/dossier';
import {
  triageDocument,
  formatTriageManifestForPrompt,
  NOTAR_DOCUMENT_TYPES,
} from './document-triage';

describe('Pre-Flight Document Triage (Deterministic Classification)', () => {
  it('classifies Grundbuchauszug by content and extracts date', () => {
    const text = `
      Amtsgericht München
      Grundbuch von Schwabing
      Blatt 12345
      Bestandsverzeichnis
      Stand: 15.03.2024
      Abteilung I: Eigentümer
    `;

    const result = triageDocument({
      fileName: 'scan_001.pdf',
      textContent: text,
    });

    expect(result.documentType).toBe(NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG);
    expect(result.reliability).toBe(DOCUMENT_RELIABILITY.HIGH);
    expect(result.detectedDate).toBe('2024-03-15');
    expect(result.confidenceScore).toBeGreaterThan(0.8);
  });

  it('classifies Energieausweis by keywords and detects expiration year', () => {
    const text = `
      ENERGIEAUSWEIS für Wohngebäude
      Endenergiebedarf dieses Gebäudes: 145 kWh/(m²*a)
      Gültig bis: 01.12.2033
    `;

    const result = triageDocument({
      fileName: 'doc_xyz.pdf',
      textContent: text,
    });

    expect(result.documentType).toBe(NOTAR_DOCUMENT_TYPES.ENERGIEAUSWEIS);
    expect(result.reliability).toBe(DOCUMENT_RELIABILITY.HIGH);
    expect(result.detectedDate).toBe('2033-12-01');
  });

  it('classifies Kaufvertragsentwurf by keywords and parties', () => {
    const text = `
      KAUFVERTRAG
      Verkäufer: Max Müller
      Käufer: Invest GmbH
      Kaufpreis: 450.000 EUR
    `;

    const result = triageDocument({
      fileName: 'entwurf_v1.pdf',
      textContent: text,
    });

    expect(result.documentType).toBe(NOTAR_DOCUMENT_TYPES.KAUFVERTRAGSENTWURF);
    expect(result.reliability).toBe(DOCUMENT_RELIABILITY.MEDIUM);
  });

  it('formats triage results into structured prompt section', () => {
    const results = [
      {
        fileName: 'grundbuch.pdf',
        documentType: NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG,
        reliability: DOCUMENT_RELIABILITY.HIGH,
        detectedDate: '2024-01-01',
        confidenceScore: 0.99,
        summary: 'Grundbuchauszug mit Bestandsverzeichnis',
      },
    ];

    const promptText = formatTriageManifestForPrompt(results);
    expect(promptText).toContain(
      '=== VORAB GEPRÜFTES AKTEN-INHALTSVERZEICHNIS (PRE-FLIGHT TRIAGE) ==='
    );
    expect(promptText).toContain(NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG);
    expect(promptText).toContain('Datum: 2024-01-01');
  });
});
