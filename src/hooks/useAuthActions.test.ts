import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthActions } from './useAuthActions';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe('useAuthActions Hook', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
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

  it('handles successful password login and redirects', async () => {
    const clearSpy = vi.spyOn(queryClient, 'clear');
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => useAuthActions({ redirectTo: '/dashboard' }), { wrapper });

    await act(async () => {
      await result.current.loginWithPassword('notar@kanzlei.de', 'geheim123');
    });

    expect(result.current.error).toBeNull();
    expect(clearSpy).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('sets error message when password login fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Falsches Passwort' }),
    } as Response);

    const { result } = renderHook(() => useAuthActions(), { wrapper });

    await act(async () => {
      await result.current.loginWithPassword('notar@kanzlei.de', 'falsch');
    });

    expect(result.current.error).toBe('Falsches Passwort');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('initiates Google SSO and triggers redirect', async () => {
    const originalHref = window.location.href;
    const locationMock = { href: originalHref };
    const originalLocation = window.location;

    Object.defineProperty(window, 'location', {
      writable: true,
      value: locationMock,
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://accounts.google.com/oauth' }),
    } as Response);

    const { result } = renderHook(() => useAuthActions(), { wrapper });

    await act(async () => {
      await result.current.loginWithGoogleSso();
    });

    expect(window.location.href).toBe('https://accounts.google.com/oauth');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('handles successful demo login and redirects', async () => {
    const clearSpy = vi.spyOn(queryClient, 'clear');
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, redirectTo: '/custom-path' }),
    } as Response);

    const { result } = renderHook(() => useAuthActions({ redirectTo: '/' }), { wrapper });

    let success = false;
    await act(async () => {
      success = await result.current.loginWithDemo();
    });

    expect(success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(clearSpy).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/custom-path');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('sets error message when demo login fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Demo-Server nicht erreichbar' }),
    } as Response);

    const { result } = renderHook(() => useAuthActions(), { wrapper });

    let success = true;
    await act(async () => {
      success = await result.current.loginWithDemo();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Demo-Server nicht erreichbar');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
