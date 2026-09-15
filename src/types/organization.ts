import { z } from 'zod';

/**
 * Berufsrechtliche Rollen im deutschen Notariat gem. BNotO & BRAO.
 */
export const NOTARY_ROLES = {
  NOTAR: 'NOTAR',
  NOTARASSESSOR: 'NOTARASSESSOR',
  SACHBEARBEITER: 'SACHBEARBEITER',
  ANWALTSNOTAR_RA: 'ANWALTSNOTAR_RA',
  ADMIN: 'ADMIN',
} as const;

export const NotaryRoleSchema = z.enum([
  NOTARY_ROLES.NOTAR,
  NOTARY_ROLES.NOTARASSESSOR,
  NOTARY_ROLES.SACHBEARBEITER,
  NOTARY_ROLES.ANWALTSNOTAR_RA,
  NOTARY_ROLES.ADMIN,
]);

export type NotaryRole = z.infer<typeof NotaryRoleSchema>;

/**
 * Kanzlei (Organization) als hermetische Mandanten-Einheit (§ 203 StGB).
 */
export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  officialSeat: z.string().min(1),
  chamberDistrict: z.string().min(1),
  taxId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

/**
 * Kanzlei-Mitgliedschaften (Zuordnung von Benutzern zu Kanzleien & Rollen).
 */
export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: NotaryRoleSchema,
  joinedAt: z.string().datetime(),
});

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;
