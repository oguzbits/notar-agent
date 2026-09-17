import { describe, it, expect } from 'vitest';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { NOTARY_ROLES } from '@/types/organization';
import { hasPermission } from './rbac';

describe('RBAC Authorization Engine (hasPermission)', () => {
  describe('NOTAR & NOTARASSESSOR', () => {
    it('erlaubt Notaren und Assessoren alle notariellen Kernaktionen', () => {
      expect(hasPermission(NOTARY_ROLES.NOTAR, PERMISSION_ACTIONS.FINAL_APPROVAL)).toBe(true);
      expect(hasPermission(NOTARY_ROLES.NOTARASSESSOR, PERMISSION_ACTIONS.FINAL_APPROVAL)).toBe(
        true
      );

      expect(hasPermission(NOTARY_ROLES.NOTAR, PERMISSION_ACTIONS.DELETE_DOSSIER)).toBe(true);
      expect(hasPermission(NOTARY_ROLES.NOTARASSESSOR, PERMISSION_ACTIONS.DELETE_DOSSIER)).toBe(
        true
      );

      expect(hasPermission(NOTARY_ROLES.NOTAR, PERMISSION_ACTIONS.EXPORT_OFFICIAL_REPORT)).toBe(
        true
      );
      expect(
        hasPermission(NOTARY_ROLES.NOTARASSESSOR, PERMISSION_ACTIONS.EXPORT_OFFICIAL_REPORT)
      ).toBe(true);

      expect(hasPermission(NOTARY_ROLES.NOTAR, PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS)).toBe(
        true
      );
      expect(hasPermission(NOTARY_ROLES.NOTAR, PERMISSION_ACTIONS.UPLOAD_DOCUMENTS)).toBe(true);
    });

    it('erlaubt dem Notar die Kanzlei- und Teamverwaltung', () => {
      expect(hasPermission(NOTARY_ROLES.NOTAR, PERMISSION_ACTIONS.MANAGE_TEAM)).toBe(true);
    });
  });

  describe(NOTARY_ROLES.SACHBEARBEITER, () => {
    it('erlaubt dem Sachbearbeiter Aktenupload und Statusbearbeitung mit Begründung', () => {
      expect(hasPermission(NOTARY_ROLES.SACHBEARBEITER, PERMISSION_ACTIONS.UPLOAD_DOCUMENTS)).toBe(
        true
      );
      expect(
        hasPermission(NOTARY_ROLES.SACHBEARBEITER, PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS)
      ).toBe(true);
    });

    it('verbietet dem Sachbearbeiter das unwiderrufliche Löschen von Akten (§ 18 BNotO)', () => {
      expect(hasPermission(NOTARY_ROLES.SACHBEARBEITER, PERMISSION_ACTIONS.DELETE_DOSSIER)).toBe(
        false
      );
    });

    it('verbietet dem Sachbearbeiter die Teamverwaltung', () => {
      expect(hasPermission(NOTARY_ROLES.SACHBEARBEITER, PERMISSION_ACTIONS.MANAGE_TEAM)).toBe(
        false
      );
    });

    it('erlaubt den Arbeitsbericht, aber keine finale Beurkundungsfreigabe', () => {
      expect(hasPermission(NOTARY_ROLES.SACHBEARBEITER, PERMISSION_ACTIONS.FINAL_APPROVAL)).toBe(
        false
      );
      expect(
        hasPermission(NOTARY_ROLES.SACHBEARBEITER, PERMISSION_ACTIONS.EXPORT_OFFICIAL_REPORT)
      ).toBe(true);
    });
  });

  describe(NOTARY_ROLES.ADMIN, () => {
    it('erlaubt Kanzlei-Administratoren Team- und Vorgangsverwaltung', () => {
      expect(hasPermission(NOTARY_ROLES.ADMIN, PERMISSION_ACTIONS.MANAGE_TEAM)).toBe(true);
      expect(hasPermission(NOTARY_ROLES.ADMIN, PERMISSION_ACTIONS.DELETE_DOSSIER)).toBe(true);
      expect(hasPermission(NOTARY_ROLES.ADMIN, PERMISSION_ACTIONS.UPLOAD_DOCUMENTS)).toBe(true);
    });

    it('verbietet reinen Administratoren die inhaltliche Freigabe', () => {
      expect(hasPermission(NOTARY_ROLES.ADMIN, PERMISSION_ACTIONS.FINAL_APPROVAL)).toBe(false);
    });
  });
});
