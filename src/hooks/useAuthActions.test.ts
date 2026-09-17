import { renderHook, act } from '@testing-library/react';
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
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('handles successful password login and redirects', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const { result } = renderHook(() => useAuthActions({ redirectTo: '/dashboard' }));

    await act(async () => {
      await result.current.loginWithPassword('notar@kanzlei.de', 'geheim123');
    });

    expect(result.current.error).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('sets error message when password login fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Falsches Passwort' }),
    } as Response);

    const { result } = renderHook(() => useAuthActions());

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

    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.loginWithGoogleSso();
    });

    expect(window.location.href).toBe('https://accounts.google.com/oauth');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});
