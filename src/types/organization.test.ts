import { describe, it, expect } from 'vitest';
import {
  NOTARY_ROLES,
  NotaryRoleSchema,
  OrganizationSchema,
  OrganizationMemberSchema,
} from './organization';

describe('Organization & NotaryRole Schemas', () => {
  it('validiert alle berufsrechtlichen Notar-Rollen korrekt', () => {
    expect(NotaryRoleSchema.parse(NOTARY_ROLES.NOTAR)).toBe(NOTARY_ROLES.NOTAR);
    expect(NotaryRoleSchema.parse(NOTARY_ROLES.NOTARASSESSOR)).toBe(NOTARY_ROLES.NOTARASSESSOR);
    expect(NotaryRoleSchema.parse(NOTARY_ROLES.SACHBEARBEITER)).toBe(NOTARY_ROLES.SACHBEARBEITER);
    expect(NotaryRoleSchema.parse(NOTARY_ROLES.ANWALTSNOTAR_RA)).toBe(NOTARY_ROLES.ANWALTSNOTAR_RA);
    expect(NotaryRoleSchema.parse(NOTARY_ROLES.ADMIN)).toBe(NOTARY_ROLES.ADMIN);

    expect(() => NotaryRoleSchema.parse('INVALID_ROLE')).toThrow();
  });

  it('validiert ein valides Kanzlei-Objekt (Organization)', () => {
    const validOrg = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Notariat Dr. Thomas Lindemann',
      officialSeat: 'Münster',
      chamberDistrict: 'Westfälische Notarkammer',
      createdAt: '2026-09-15T12:00:00.000Z',
      updatedAt: '2026-09-15T12:00:00.000Z',
    };

    const parsed = OrganizationSchema.parse(validOrg);
    expect(parsed.id).toBe(validOrg.id);
    expect(parsed.name).toBe('Notariat Dr. Thomas Lindemann');
    expect(parsed.officialSeat).toBe('Münster');
  });

  it('validiert Kanzlei-Mitgliedschaften (OrganizationMember)', () => {
    const validMember = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      role: NOTARY_ROLES.NOTAR,
      joinedAt: '2026-09-15T12:00:00.000Z',
    };

    const parsed = OrganizationMemberSchema.parse(validMember);
    expect(parsed.role).toBe(NOTARY_ROLES.NOTAR);
    expect(parsed.organizationId).toBe(validMember.organizationId);
  });
});
