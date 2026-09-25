'use client';

import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Input, Card, CardContent, GoogleIcon } from '@/components/ui';
import { useAuthActions } from '@/hooks/useAuthActions';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const urlError = searchParams.get('error');

  const initialError = React.useMemo(() => {
    if (urlError === 'sso_failed')
      return 'Google SSO Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
    if (urlError === 'missing_code') return 'Ungültige Rückleitung von SSO. Bitte erneut anmelden.';
    if (urlError === 'auth_unavailable')
      return 'Authentifizierungsdienst derzeit nicht erreichbar.';
    return null;
  }, [urlError]);

  const { isLoadingPassword, isLoadingSso, error, loginWithPassword, loginWithGoogleSso } =
    useAuthActions({ redirectTo, initialError });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithPassword(email, password);
  };

  return (
    <Card>
      <CardContent className="p-6 sm:p-10">
        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="border-destructive/20 bg-destructive/10 text-destructive mb-6 flex items-start gap-3 rounded-lg border p-3.5 text-base"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Google SSO Button */}
        <div>
          <Button
            type="button"
            variant="outline"
            size="md"
            isLoading={isLoadingSso}
            onClick={loginWithGoogleSso}
            className="w-full justify-center"
            leftIcon={<GoogleIcon className="h-5 w-5" />}
          >
            Mit Google anmelden
          </Button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="border-border w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-card text-muted-foreground px-3">oder mit E-Mail und Passwort</span>
          </div>
        </div>

        {/* Password Form */}
        <form className="space-y-5" onSubmit={handleSubmit}>
          <Input
            id="email"
            name="email"
            type="email"
            label="E-Mail-Adresse"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@kanzlei.de"
            leftIcon={<Mail className="h-5 w-5" />}
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Passwort"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={<Lock className="h-5 w-5" />}
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoadingPassword}
              className="w-full justify-center"
              rightIcon={<ArrowRight className="h-5 w-5" />}
            >
              Anmelden
            </Button>
          </div>
        </form>

        {/* Footer Registration Link */}
        <div className="border-border mt-8 border-t pt-5 text-center">
          <p className="text-muted-foreground text-base">
            Neu bei Notar Agent?{' '}
            <Link href="/register" className="text-notar-900 font-semibold hover:underline">
              Neue Kanzlei registrieren
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="text-foreground text-3xl font-bold tracking-tight">Anmeldung</h1>
        <p className="text-muted-foreground mt-2 text-base leading-relaxed">
          Melden Sie sich mit Ihrem Kanzleikonto an
        </p>
      </div>

      {/* Main Card wrapped in Suspense */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense
          fallback={
            <Card>
              <CardContent className="flex min-h-96 items-center justify-center p-10">
                <Loader2 className="text-notar-900 h-8 w-8 animate-spin" />
              </CardContent>
            </Card>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
