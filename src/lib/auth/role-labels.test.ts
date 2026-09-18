import { describe, it, expect } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { ROLE_LABELS_DE, ROLE_AUTHORITY_DESCRIPTIONS_DE } from './role-labels';

describe('Rollenbezeichnungen & Befugnisse (role-labels)', () => {
  it('stellt kanonische deutsche Bezeichnungen für alle Rollen bereit (ROLE_LABELS_DE)', () => {
    expect(ROLE_LABELS_DE[NOTARY_ROLES.NOTAR]).toBe('Notar / Notarin (Amtsinhaber)');
    expect(ROLE_LABELS_DE[NOTARY_ROLES.NOTARASSESSOR]).toBe('Notarassessor / Notarassessorin');
    expect(ROLE_LABELS_DE[NOTARY_ROLES.SACHBEARBEITER]).toBe('Notarfachwirt(in) / Sachbearbeitung');
    expect(ROLE_LABELS_DE[NOTARY_ROLES.ANWALTSNOTAR_RA]).toBe('Anwaltsnotar(in) / Rechtsanwalt');
    expect(ROLE_LABELS_DE[NOTARY_ROLES.ADMIN]).toBe('Kanzlei-Administrator');
  });

  it('stellt amtliche Befugnisbeschreibungen für alle Rollen bereit (ROLE_AUTHORITY_DESCRIPTIONS_DE)', () => {
    expect(ROLE_AUTHORITY_DESCRIPTIONS_DE[NOTARY_ROLES.NOTAR]).toContain('§ 17 BeurkG');
    expect(ROLE_AUTHORITY_DESCRIPTIONS_DE[NOTARY_ROLES.NOTARASSESSOR]).toBe(
      'Vorbereitungs- & behördliche Vertretungsbefugnis'
    );
    expect(ROLE_AUTHORITY_DESCRIPTIONS_DE[NOTARY_ROLES.SACHBEARBEITER]).toBe(
      'Aktenführung, Vollzug & Urkundenvorbereitung'
    );
    expect(ROLE_AUTHORITY_DESCRIPTIONS_DE[NOTARY_ROLES.ANWALTSNOTAR_RA]).toBe(
      'Vollständige notarielle & anwaltliche Sachbearbeitung'
    );
    expect(ROLE_AUTHORITY_DESCRIPTIONS_DE[NOTARY_ROLES.ADMIN]).toBe(
      'Technische Mandanten- & Systemverwaltung'
    );
  });
});
