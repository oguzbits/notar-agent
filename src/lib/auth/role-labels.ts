import { NOTARY_ROLES, NotaryRole } from '@/types/organization';

export const ROLE_LABELS_DE: Record<NotaryRole, string> = {
  [NOTARY_ROLES.NOTAR]: 'Notar / Notarin (Amtsinhaber)',
  [NOTARY_ROLES.NOTARASSESSOR]: 'Notarassessor / Notarassessorin',
  [NOTARY_ROLES.SACHBEARBEITER]: 'Notarfachwirt(in) / Sachbearbeitung',
  [NOTARY_ROLES.ANWALTSNOTAR_RA]: 'Anwaltsnotar(in) / Rechtsanwalt',
  [NOTARY_ROLES.ADMIN]: 'Kanzlei-Administrator',
};

/**
 * Amtliche Befugnisbeschreibung nach TriNotar / NoRA Standard.
 */
export const ROLE_AUTHORITY_DESCRIPTIONS_DE: Record<NotaryRole, string> = {
  [NOTARY_ROLES.NOTAR]: 'Volle Beurkundungs- & Siegelbefugnis (§ 17 BeurkG)',
  [NOTARY_ROLES.NOTARASSESSOR]: 'Vorbereitungs- & behördliche Vertretungsbefugnis',
  [NOTARY_ROLES.SACHBEARBEITER]: 'Aktenführung, Vollzug & Urkundenvorbereitung',
  [NOTARY_ROLES.ANWALTSNOTAR_RA]: 'Vollständige notarielle & anwaltliche Sachbearbeitung',
  [NOTARY_ROLES.ADMIN]: 'Technische Mandanten- & Systemverwaltung',
};
