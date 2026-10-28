import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from './security-headers';

describe('SECURITY_HEADERS', () => {
  const value = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

  it('verbietet Einbettung in fremde Seiten und MIME-Sniffing', () => {
    expect(value('X-Frame-Options')).toBe('DENY');
    expect(value('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(value('X-Content-Type-Options')).toBe('nosniff');
  });

  it('erzwingt HTTPS und sperrt Gerätezugriffe', () => {
    expect(value('Strict-Transport-Security')).toContain('max-age=');
    expect(value('Permissions-Policy')).toContain('camera=()');
  });
});
