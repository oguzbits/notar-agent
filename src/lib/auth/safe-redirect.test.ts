import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('gibt den normalisierten Pfad zurück', () => {
    expect(safeRedirectPath('/a/../vorgang?id=1#feld')).toBe('/vorgang?id=1#feld');
  });

  it.each([
    '@evil.example',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    '/.//evil.example',
    '/..//evil.example',
    '/x/..//evil.example',
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
