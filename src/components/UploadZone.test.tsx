import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UploadZone } from './UploadZone';

function renderZone(isAnalyzing = false) {
  const { container } = render(
    <UploadZone onFilesReady={vi.fn()} notes="" onNotesChange={vi.fn()} isAnalyzing={isAnalyzing} />
  );
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Datei-Eingabe fehlt');
  const clickSpy = vi.spyOn(input, 'click');
  return { zone: screen.getByRole('button', { name: /Dokumente auswählen/ }), clickSpy };
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
