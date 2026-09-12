'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Boundary caught error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="bg-destructive/10 text-destructive mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-xs">
        <AlertCircle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
        Ein unerwarteter Systemfehler ist aufgetreten
      </h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Die Benutzeroberfläche konnte diesen Schritt nicht abschließen. Ihre Akten und Daten wurden
        nicht beschädigt.
      </p>
      {error.message && (
        <div className="bg-muted/80 text-muted-foreground border-border mt-4 max-w-lg rounded-lg border px-3.5 py-2 font-mono text-xs">
          {error.message}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Ansicht wiederherstellen
        </Button>
        <Link
          href="/"
          className="bg-background text-foreground hover:bg-muted inline-flex items-center justify-center rounded-md border border-slate-200 px-4 py-2 text-base font-semibold shadow-xs transition-colors"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
