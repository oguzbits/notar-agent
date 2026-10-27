import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EXPORT_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { downloadTextFile } from '@/lib/export';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { ExportActions } from './ExportActions';

vi.mock('@/lib/export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/export')>()),
  downloadTextFile: vi.fn(),
  downloadJsonFile: vi.fn(),
}));

const fetchMock = vi.fn();
const dossier = createTestImmobilienDossier({ caseTitle: 'Kaufvertrag' });
const exportReport = () => fireEvent.click(screen.getByRole('button', { name: /Prüfbericht/ }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(downloadTextFile).mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('ExportActions Prüfbericht', () => {
  it('erzeugt den Bericht mit Prüfprotokoll', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ history: [], integrity: { valid: true } }),
    });
    render(<ExportActions dossier={dossier} documentId="doc-1" />);

    exportReport();

    await waitFor(() => expect(downloadTextFile).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('bricht bei Antwortfehler des Prüfprotokolls mit Meldung ab, ohne Bericht zu erzeugen', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<ExportActions dossier={dossier} documentId="doc-1" />);

    exportReport();

    expect((await screen.findByRole('alert')).textContent).toBe(EXPORT_UI_TEXTS_DE.AUDIT_FEHLT);
    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: /Prüfbericht/ }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('bricht bei Netzwerkfehler ab', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<ExportActions dossier={dossier} documentId="doc-1" />);

    exportReport();

    expect((await screen.findByRole('alert')).textContent).toBe(EXPORT_UI_TEXTS_DE.AUDIT_FEHLT);
    expect(downloadTextFile).not.toHaveBeenCalled();
  });
});
