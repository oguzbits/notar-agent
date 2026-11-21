import { describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER, parseRequestId, resolveRequestId } from './request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('verwendet den Header x-request-id', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });

  it('übernimmt eine gültige Kennung', () => {
    expect(resolveRequestId('abc12345_-XYZ')).toBe('abc12345_-XYZ');
    expect(resolveRequestId('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it.each([
    ['Zeilenumbruch (Log-Injection)', 'abc12345\nlevel=error'],
    ['Steuerzeichen', 'abc12345\u0000xyz'],
    ['Leerzeichen', 'abc 12345'],
    ['Überlänge', 'a'.repeat(65)],
    ['zu kurz', 'abc1234'],
    ['leer', ''],
    ['null', null],
    ['undefined', undefined],
  ])('ersetzt eine ungültige Kennung: %s', (_label, incoming) => {
    const id = resolveRequestId(incoming);
    expect(id).toMatch(UUID);
    expect(id).not.toBe(incoming);
  });
});

describe('parseRequestId', () => {
  it('liefert die gültige Kennung, sonst undefined (keine Ersatzkennung)', () => {
    expect(parseRequestId('abc12345')).toBe('abc12345');
    expect(parseRequestId('a\nb')).toBeUndefined();
    expect(parseRequestId(null)).toBeUndefined();
  });
});
