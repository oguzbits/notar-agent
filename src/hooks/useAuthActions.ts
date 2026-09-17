import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SSO_PROVIDERS } from '@/types/auth';

export interface UseAuthActionsOptions {
  redirectTo?: string;
  initialError?: string | null;
}

export interface UseAuthActionsResult {
  isLoadingPassword: boolean;
  isLoadingSso: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  loginWithGoogleSso: () => Promise<void>;
}

export function useAuthActions({
  redirectTo = '/',
  initialError = null,
}: UseAuthActionsOptions = {}): UseAuthActionsResult {
  const router = useRouter();
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isLoadingSso, setIsLoadingSso] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

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

      if (data.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler beim Google-Login.';
      setError(msg);
      setIsLoadingSso(false);
    }
  };

  return {
    isLoadingPassword,
    isLoadingSso,
    error,
    setError,
    loginWithPassword,
    loginWithGoogleSso,
  };
}
