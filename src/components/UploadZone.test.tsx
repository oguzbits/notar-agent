import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFilesDirectly } from '@/lib/files/storage-uploader';
import type { UploadedFilePayload } from '@/types/dossier';
import { UploadZone } from './UploadZone';

vi.mock('@/lib/files/storage-uploader', () => ({ uploadFilesDirectly: vi.fn() }));
const mockUpload = vi.mocked(uploadFilesDirectly);

beforeEach(() => {
  mockUpload.mockReset();
});

function renderZone(isAnalyzing = false) {
  const { container } = render(
    <UploadZone onFilesReady={vi.fn()} notes="" onNotesChange={vi.fn()} isAnalyzing={isAnalyzing} />
  );
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Datei-Eingabe fehlt');
  const clickSpy = vi.spyOn(input, 'click');
  return { zone: screen.getByRole('button', { name: /Dateien per Drag/ }), clickSpy };
}

describe('UploadZone Tastaturbedienung', () => {
  it('ist per Tastatur fokussierbar und öffnet mit Enter den Dateidialog', () => {
    const { zone, clickSpy } = renderZone();
    expect(zone.tabIndex).toBe(0);
    fireEvent.keyDown(zone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('öffnet auch mit der Leertaste den Dateidialog', () => {
    const { zone, clickSpy } = renderZone();
    fireEvent.keyDown(zone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('bleibt während der Analyse gesperrt', () => {
    const { zone, clickSpy } = renderZone(true);
    expect(zone.getAttribute('aria-disabled')).toBe('true');
    expect(zone.tabIndex).toBe(-1);
    fireEvent.keyDown(zone, { key: 'Enter' });
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('UploadZone Upload', () => {
  const payload = (name: string): UploadedFilePayload => ({
    name,
    size: 2048,
    type: 'application/pdf',
    storagePath: `org/${name}`,
  });
  const pdf = (name: string) => new File(['x'], name, { type: 'application/pdf' });

  function renderControlled(files: UploadedFilePayload[]) {
    const onFilesReady = vi.fn();
    const { container } = render(
      <UploadZone
        files={files}
        onFilesReady={onFilesReady}
        notes=""
        onNotesChange={vi.fn()}
        isAnalyzing={false}
      />
    );
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Datei-Eingabe fehlt');
    return { input, onFilesReady };
  }

  it('zeigt während des Hochladens den Fortschritt und danach nicht mehr', async () => {
    let finish: (files: UploadedFilePayload[]) => void = () => undefined;
    let report: (done: number, total: number) => void = () => undefined;
    mockUpload.mockImplementation(
      (_files, options) =>
        new Promise((resolve) => {
          report = options?.onProgress ?? report;
          finish = resolve;
        })
    );
    const { input, onFilesReady } = renderControlled([]);

    fireEvent.change(input, { target: { files: [pdf('a.pdf'), pdf('b.pdf')] } });

    expect((await screen.findByRole('status')).textContent).toContain('0 von 2');
    report(1, 2);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 von 2'));

    finish([payload('a.pdf'), payload('b.pdf')]);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(onFilesReady).toHaveBeenCalledWith([payload('a.pdf'), payload('b.pdf')]);
  });

  it('sperrt das Entfernen während des Uploads, damit keine Datei zurückkehrt', async () => {
    mockUpload.mockImplementation(() => new Promise(() => undefined));
    const { input } = renderControlled([payload('alt.pdf')]);
    expect(screen.getByRole('button', { name: 'Datei alt.pdf entfernen' })).toBeTruthy();

    fireEvent.change(input, { target: { files: [pdf('neu.pdf')] } });

    await screen.findByRole('status');
    expect(screen.queryByRole('button', { name: 'Datei alt.pdf entfernen' })).toBeNull();
  });

  it('lädt beim Hinzufügen nur die neuen Dateien hoch und behält die vorhandenen', async () => {
    mockUpload.mockResolvedValue([payload('neu.pdf')]);
    const { input, onFilesReady } = renderControlled([payload('alt.pdf')]);
    const neu = pdf('neu.pdf');

    fireEvent.change(input, { target: { files: [neu] } });

    await waitFor(() => expect(onFilesReady).toHaveBeenCalled());
    expect(mockUpload.mock.calls[0]?.[0]).toEqual([neu]);
    expect(onFilesReady).toHaveBeenCalledWith([payload('alt.pdf'), payload('neu.pdf')]);
  });

  it('entfernt eine Datei ohne erneuten Upload', () => {
    const { onFilesReady } = renderControlled([payload('a.pdf'), payload('b.pdf')]);

    fireEvent.click(screen.getByRole('button', { name: 'Datei a.pdf entfernen' }));

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onFilesReady).toHaveBeenCalledWith([payload('b.pdf')]);
  });

  it('meldet einen Fehler und zeigt danach keinen Fortschritt mehr', async () => {
    mockUpload.mockRejectedValue(new Error('Dienst nicht erreichbar'));
    const { input, onFilesReady } = renderControlled([]);

    fireEvent.change(input, { target: { files: [pdf('a.pdf')] } });

    expect(await screen.findByText('Fehler beim Einlesen einzelner Dateien.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(onFilesReady).not.toHaveBeenCalled();
  });
});
