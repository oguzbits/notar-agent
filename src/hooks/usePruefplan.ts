'use client';

import { useQuery } from '@tanstack/react-query';
import { CaseType } from '@/types/dossier';
import { Pruefplan, PruefplanSchema } from '@/types/pruefplan';

async function fetchPruefplan(caseType: CaseType): Promise<Pruefplan> {
  const res = await fetch(`/api/pruefplan?caseType=${encodeURIComponent(caseType)}`);
  if (!res.ok) {
    throw new Error('Prüfplan konnte nicht geladen werden');
  }
  return PruefplanSchema.parse(await res.json());
}

export function usePruefplan(caseType: CaseType, enabled: boolean) {
  return useQuery({
    queryKey: ['pruefplan', caseType],
    queryFn: () => fetchPruefplan(caseType),
    enabled,
  });
}
