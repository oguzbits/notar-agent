import { CaseTypeSchema, Dossier, isImmobilienDossier } from '@/types/dossier';
import {
  CASE_TYPE_LABELS_DE,
  CASE_TITLE_FALLBACK_DE,
  CASE_TITLE_PARTY_SEPARATOR_DE,
} from './constants';

interface CaseTitleInput {
  caseType?: string;
  parties: string[];
  /** ISO-Zeitpunkt der Anlage; Ersatz für den Zusatz, solange keine Beteiligten erfasst sind. */
  date?: string;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
});

/** Beteiligte aus den Dossierdaten (Reihenfolge wie im Kaufvertragsrubrum). */
export function getCaseParties(dossier: Dossier): string[] {
  return isImmobilienDossier(dossier)
    ? [dossier.fields.verkaeufer.data.name, dossier.fields.kaeufer.data.companyName]
    : [dossier.fields.firma.data.companyName];
}

/** Kanzleitaugliche Vorgangsbezeichnung: Vorgangsart plus Beteiligte, sonst Anlagedatum. */
export function formatCaseTitle({ caseType, parties, date }: CaseTitleInput): string {
  const parsed = CaseTypeSchema.safeParse(caseType);
  const label = parsed.success ? CASE_TYPE_LABELS_DE[parsed.data] : CASE_TITLE_FALLBACK_DE;
  const names = parties.map((name) => name.trim()).filter(Boolean);
  if (names.length > 0) return `${label} – ${names.join(CASE_TITLE_PARTY_SEPARATOR_DE)}`;
  const time = date ? new Date(date) : undefined;
  if (time && !Number.isNaN(time.getTime())) return `${label} vom ${dateFormat.format(time)}`;
  return label;
}
