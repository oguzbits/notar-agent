'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { AuthProvider } from '@/providers/AuthProvider';

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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
