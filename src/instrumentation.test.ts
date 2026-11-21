import * as Sentry from '@sentry/nextjs';
import { describe, expect, it, vi } from 'vitest';

const setTag = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: typeof setTag }) => void) => cb({ setTag })),
}));

import { onRequestError } from './instrumentation';

const context = { routerKind: 'App Router', routePath: '/api/x', routeType: 'route' };
const call = (headers: Record<string, string | string[] | undefined>) => {
  setTag.mockClear();
  vi.mocked(Sentry.captureRequestError).mockClear();
  onRequestError(new Error('boom'), { path: '/api/x', method: 'POST', headers }, context);
};

describe('onRequestError', () => {
  it('setzt den Tag request_id aus dem Header und meldet den Fehler', () => {
    call({ 'x-request-id': 'req-12345678' });
    expect(setTag).toHaveBeenCalledWith('request_id', 'req-12345678');
    expect(Sentry.captureRequestError).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ungültig', { 'x-request-id': 'a\nb' }],
    ['fehlend', {}],
    ['mehrfach', { 'x-request-id': ['req-12345678', 'req-87654321'] }],
  ])('setzt keinen Tag bei %s Kennung, meldet aber weiterhin', (_label, headers) => {
    call(headers);
    expect(setTag).not.toHaveBeenCalled();
    expect(Sentry.captureRequestError).toHaveBeenCalledTimes(1);
  });
});
