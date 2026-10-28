import { FIELD_STATUS, GenericFieldDossier } from '@/types/dossier';

/** Ein Wert des Auditors weicht von einem vorhandenen Eintrag ab (neue Schlüssel ergänzen nur). */
function rewrites(base: Record<string, unknown>, patch?: Record<string, unknown>): boolean {
  return Object.entries(patch ?? {}).some(
    ([key, value]) => key in base && JSON.stringify(base[key]) !== JSON.stringify(value)
  );
}

export function guardAuditorPatch(
  base: GenericFieldDossier,
  patch: Partial<GenericFieldDossier<Record<string, unknown>>>,
  flagged: boolean
): Partial<GenericFieldDossier<Record<string, unknown>>> {
  const raisesToVerified = patch.status === FIELD_STATUS.VERIFIED;
  if (base.status !== FIELD_STATUS.VERIFIED || flagged) {
    return raisesToVerified ? { ...patch, status: undefined } : patch;
  }
  const rewritesEvidence =
    rewrites(base.data, patch.data) ||
    rewrites(base.source as Record<string, unknown>, patch.source as Record<string, unknown>);
  return rewritesEvidence && (raisesToVerified || !patch.status)
    ? { ...patch, status: FIELD_STATUS.NEEDS_REVIEW }
    : patch;
}
