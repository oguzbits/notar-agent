import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each([
    '@evil.example',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('fremdes oder ungültiges Ziel %j wird zu /', (target) => {
    expect(safeRedirectPath(target)).toBe('/');
  });

  it.each(['/', '/vorgang?id=1', '/dossier/abc#feld', '/@team'])(
    'relativer Pfad %j bleibt erhalten',
    (target) => {
      expect(safeRedirectPath(target)).toBe(target);
    }
  );
});
