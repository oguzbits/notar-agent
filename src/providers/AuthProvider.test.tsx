import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { AuthProvider, useAuth } from './AuthProvider';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock('@/hooks/useTeam', () => ({
  useTeam: () => ({
    members: [
      {
        id: 'member-1',
        name: 'Dr. Test Notar',
        email: 'notar@kanzlei.de',
        role: NOTARY_ROLES.NOTAR,
        title: 'Notar',
        joinedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'member-2',
        name: 'Sabine Assessorin',
        email: 'assessorin@kanzlei.de',
        role: NOTARY_ROLES.NOTARASSESSOR,
        title: 'Notarassessorin',
        joinedAt: '2026-02-01T00:00:00Z',
      },
    ],
    isLoading: false,
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    inviteMember: vi.fn(),
  }),
}));

describe('AuthProvider', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('never returns a dummy default organization when unauthenticated or loading', async () => {
    // 401 unauthenticated response from /api/auth/me
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // While loading or unauthenticated: organization and currentUser must be NULL, never dummy/fallback
    expect(result.current.organization).toBeNull();
    expect(result.current.hasActiveOrganization).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoadingSession).toBe(false);
    });

    // After loading finishes with 401: organization and currentUser must remain NULL
    expect(result.current.organization).toBeNull();
    expect(result.current.hasActiveOrganization).toBe(false);
    expect(result.current.currentUser).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets organization and user details when authenticated session is received', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'member-1',
          name: 'Dr. Test Notar',
          email: 'notar@kanzlei.de',
          role: NOTARY_ROLES.NOTAR,
        },
        organization: {
          id: 'org-real-123',
          name: 'Notariat Dr. Muster & Partner',
          officialSeat: 'Köln',
          chamberDistrict: 'Rheinische Notarkammer',
        },
        hasActiveOrganization: true,
      }),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingSession).toBe(false);
    });

    expect(result.current.hasActiveOrganization).toBe(true);
    expect(result.current.organization).toEqual({
      id: 'org-real-123',
      name: 'Notariat Dr. Muster & Partner',
      officialSeat: 'Köln',
      chamberDistrict: 'Rheinische Notarkammer',
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: '2026-01-01T08:00:00.000Z',
    });
    expect(result.current.currentUser?.name).toBe('Dr. Test Notar');
  });

  it('switches simulated user and clears simulation on logout', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'member-1',
          name: 'Dr. Test Notar',
          email: 'notar@kanzlei.de',
          role: NOTARY_ROLES.NOTAR,
        },
        organization: null,
        hasActiveOrganization: false,
      }),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingSession).toBe(false);
    });

    expect(result.current.currentUser?.id).toBe('member-1');

    act(() => {
      result.current.switchUser('member-2');
    });

    expect(result.current.currentUser?.id).toBe('member-2');
    expect(result.current.currentUser?.name).toBe('Sabine Assessorin');

    // Logout
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await act(async () => {
      await result.current.logout();
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
