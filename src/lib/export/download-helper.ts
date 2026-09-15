import { saveAs } from 'file-saver';

/**
 * Hilfsfunktionen für clientseitige Dateidownloads via Industrie-Standard file-saver.
 * Kapselt plattformübergreifendes Blob-Handling und browser-spezifische Download-Mechanismen.
 */

export function downloadJsonFile(fileName: string, data: unknown): void {
  if (typeof window === 'undefined') return;

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  saveAs(blob, fileName);
}

export function downloadTextFile(fileName: string, textContent: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  saveAs(blob, fileName);
}
