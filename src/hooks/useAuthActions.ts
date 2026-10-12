import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AUTH_SESSION_QUERY_KEY, AUTH_STORAGE_KEY_USER_ID } from '@/providers/AuthProvider';
import { SSO_PROVIDERS } from '@/types/auth';

export interface UseAuthActionsOptions {
  redirectTo?: string;
  initialError?: string | null;
}

export interface UseAuthActionsResult {
  isLoadingPassword: boolean;
  isLoadingSso: boolean;
  isLoadingDemo: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  loginWithGoogleSso: () => Promise<void>;
  loginWithDemo: () => Promise<boolean>;
}

export function useAuthActions({
  redirectTo = '/',
  initialError = null,
}: UseAuthActionsOptions = {}): UseAuthActionsResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isLoadingSso, setIsLoadingSso] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const resetClientSessionState = () => {
    queryClient.clear();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY_USER_ID);
      } catch (err) {
        console.debug('Fehler beim Zurücksetzen des Auth-Storage:', err);
      }
    }
    void queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
  };

  const loginWithPassword = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoadingPassword(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, redirectTo }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Anmeldung fehlgeschlagen.');
      }

      resetClientSessionState();
      router.push(redirectTo);
      router.refresh();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Anmeldung.';
      setError(msg);
      return false;
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const loginWithGoogleSso = async (): Promise<void> => {
    setError(null);
    setIsLoadingSso(true);

    try {
      const res = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: SSO_PROVIDERS.GOOGLE, redirectTo }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Starten der Google-Anmeldung.');
      }

      resetClientSessionState();
      if (data.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler beim Google-Login.';
      setError(msg);
      setIsLoadingSso(false);
    }
  };

  const loginWithDemo = async (): Promise<boolean> => {
    setError(null);
    setIsLoadingDemo(true);

    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Demo-Anmeldung fehlgeschlagen.');
      }

      resetClientSessionState();
      router.push(data.redirectTo || redirectTo);
      router.refresh();
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Demo-Anmeldung.';
      setError(msg);
      return false;
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return {
    isLoadingPassword,
    isLoadingSso,
    isLoadingDemo,
    error,
    setError,
    loginWithPassword,
    loginWithGoogleSso,
    loginWithDemo,
  };
}
