'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Sofortige Cache-Anzeige mit lautlosem Hintergrund-Sync (stale-while-revalidate)
            refetchOnWindowFocus: true, // Automatische Aktualisierung bei Rückkehr zum Browser-Tab
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
