'use client';

import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de" className="h-full">
      <body className="bg-background text-foreground flex min-h-full flex-col items-center justify-center p-6 font-sans">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="bg-destructive/10 text-destructive mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
            Kritischer Anwendungsfehler
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Die Grundstruktur der Anwendung ist auf einen Ausnahmefehler gestoßen.
          </p>
          {error.message && (
            <div className="border-border bg-muted/50 text-muted-foreground mt-4 rounded-lg border px-3.5 py-2 font-mono text-xs">
              {error.message}
            </div>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="bg-notar-500 text-notar-950 hover:bg-notar-600 focus-visible:ring-notar-900 mt-6 inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-base font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
          >
            Anwendung neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
