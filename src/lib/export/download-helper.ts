/**
 * Hilfsfunktionen für clientseitige Dateidownloads.
 * Kapselt Blob-Erzeugung, DOM-Trigger und deterministisches Memory-Cleanup (revokeObjectURL).
 */

export function downloadJsonFile(fileName: string, data: unknown): void {
  if (typeof window === 'undefined') return;

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.setAttribute('href', objectUrl);
  anchor.setAttribute('download', fileName);
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

export function downloadTextFile(fileName: string, textContent: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.setAttribute('href', objectUrl);
  anchor.setAttribute('download', fileName);
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
