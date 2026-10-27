import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { useTeam } from './useTeam';

const MELDUNG = 'Die Einladung von Mitarbeitenden ist noch nicht verfügbar.';
const server = setupServer(
  http.post('/api/team', () => HttpResponse.json({ error: MELDUNG }, { status: 501 }))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useTeam', () => {
  it('reicht die Meldung des Servers bei abgelehnter Einladung weiter', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTeam({ enabled: false }), { wrapper });

    await expect(
      result.current.inviteMember({
        name: 'Frau Akte',
        email: 'akte@kanzlei.de',
        role: NOTARY_ROLES.SACHBEARBEITER,
      })
    ).rejects.toThrow(MELDUNG);
  });
});
