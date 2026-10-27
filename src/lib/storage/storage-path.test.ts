import { describe, it, expect } from 'vitest';
import { isOwnUploadPath } from './storage-path';

describe('isOwnUploadPath', () => {
  const org = 'a0000000-0000-4000-8000-000000000001';
  it('erlaubt <Kanzlei>/<Datei>', () => {
    expect(isOwnUploadPath(`${org}/11111111-kaufvertrag.pdf`, org)).toBe(true);
  });
  it.each([
    ['fremde Kanzlei', 'b0000000-0000-4000-8000-000000000002/x.pdf'],
    ['Archivpfad', `${org}/archive/akte/snapshot-1.json`],
    ['zweiter Schrägstrich', `${org}/unter/x.pdf`],
    ['Elternverweis', `${org}/..x.pdf`],
    ['leerer Rest', `${org}/`],
    ['nur Kanzlei', org],
    ['Präfix ohne Trenner', `${org}x/y.pdf`],
  ])('lehnt ab: %s', (_label, path) => {
    expect(isOwnUploadPath(path, org)).toBe(false);
  });
});
