import { describe, it, expect } from 'vitest';
import { NOTAR_DOCUMENT_TYPES } from '@/types/dossier';
import {
  isCoreNotarDocument,
  shouldApplyDocumentWindowing,
  createDocumentWindows,
  routeAndWindowDocument,
  STANDARD_DOSSIER_PAGE_LIMIT,
  MEGA_ARCHIVE_PAGE_LIMIT,
} from './document-windowing';

describe('document-windowing', () => {
  describe('isCoreNotarDocument', () => {
    it('identifies dispositive core documents that must never be windowed or truncated', () => {
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.KAUFVERTRAGSENTWURF)).toBe(true);
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG)).toBe(true);
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.HANDELSREGISTER)).toBe(true);
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.ENERGIEAUSWEIS)).toBe(true);
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.PERSONALAUSWEIS)).toBe(true);
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ)).toBe(true);
    });

    it('identifies secondary / archive documents that are eligible for windowing when massive', () => {
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.SONSTIGES)).toBe(false);
      expect(isCoreNotarDocument(NOTAR_DOCUMENT_TYPES.MIETUEBERSICHT)).toBe(false);
    });
  });

  describe('shouldApplyDocumentWindowing', () => {
    it('returns false for standard dossiers below page or character limit', () => {
      expect(shouldApplyDocumentWindowing(50, 80_000)).toBe(false);
      expect(shouldApplyDocumentWindowing(STANDARD_DOSSIER_PAGE_LIMIT, 200_000)).toBe(false);
    });

    it('returns true when page count exceeds mega archive limit (> 150 pages)', () => {
      expect(shouldApplyDocumentWindowing(MEGA_ARCHIVE_PAGE_LIMIT + 1, 100_000)).toBe(true);
      expect(shouldApplyDocumentWindowing(220, 100_000)).toBe(true);
    });

    it('returns true when character volume exceeds global maximum (> 300.000 characters)', () => {
      expect(shouldApplyDocumentWindowing(85, 350_000)).toBe(true);
    });
  });

  describe('createDocumentWindows', () => {
    it('returns a single window if content is smaller than chunk size', () => {
      const text = 'Kurzer Aktenbestand ohne Überlänge.';
      const windows = createDocumentWindows(text, { chunkSize: 10_000, overlap: 500 });

      expect(windows).toHaveLength(1);
      expect(windows[0]?.windowIndex).toBe(1);
      expect(windows[0]?.totalWindows).toBe(1);
      expect(windows[0]?.content).toBe(text);
    });

    it('segments massive content into overlapping sliding windows preserving clause boundaries', () => {
      // 150.000 Zeichen Testtext mit Absätzen
      const paragraphs = Array.from({ length: 150 }, (_, i) =>
        `Paragraph § ${i + 1}: Ausführliche Bestimmung mit ca. tausend Zeichen Inhalt. `.repeat(10)
      );
      const hugeText = paragraphs.join('\n\n');

      const windows = createDocumentWindows(hugeText, { chunkSize: 50_000, overlap: 3_000 });

      expect(windows.length).toBeGreaterThan(1);
      for (const w of windows) {
        expect(w.totalWindows).toBe(windows.length);
        expect(w.content.length).toBeGreaterThan(0);
      }
      expect(windows[0]?.windowIndex).toBe(1);
      expect(windows[windows.length - 1]?.windowIndex).toBe(windows.length);
    });
  });

  describe('routeAndWindowDocument', () => {
    it('preserves core documents entirely without windowing even if large', () => {
      const longContract = 'Kaufvertrag Text '.repeat(50_000);
      const result = routeAndWindowDocument({
        fileName: 'Kaufvertragsentwurf_Grossband.pdf',
        documentType: NOTAR_DOCUMENT_TYPES.KAUFVERTRAGSENTWURF,
        content: longContract,
        pageCount: 160,
      });

      expect(result.isWindowed).toBe(false);
      expect(result.windows).toHaveLength(1);
      expect(result.windows[0]?.content).toBe(longContract);
      expect(result.routingCategory).toBe('CORE_PRESERVED');
    });

    it('windows secondary archive documents when they exceed threshold', () => {
      const massiveArchive = 'Altaktenband historische Teilungserklärung '.repeat(20_000);
      const result = routeAndWindowDocument({
        fileName: 'Anlage_Historische_Bauakten.pdf',
        documentType: NOTAR_DOCUMENT_TYPES.SONSTIGES,
        content: massiveArchive,
        pageCount: 180,
      });

      expect(result.isWindowed).toBe(true);
      expect(result.windows.length).toBeGreaterThan(1);
      expect(result.routingCategory).toBe('ARCHIVE_WINDOWED');
      expect(result.windows[0]?.label).toContain('Fenster 1 von');
    });
  });
});
