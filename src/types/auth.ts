import { z } from 'zod';
import { NotaryRoleSchema } from './organization';

/**
 * Kanonische sicherheits- und freigabekritische Aktionen im Kanzleisystem.
 */
export const PERMISSION_ACTIONS = {
  DELETE_DOSSIER: 'DELETE_DOSSIER',
  FINAL_APPROVAL: 'FINAL_APPROVAL',
  OVERRIDE_FIELD_STATUS: 'OVERRIDE_FIELD_STATUS',
  EXPORT_OFFICIAL_REPORT: 'EXPORT_OFFICIAL_REPORT',
  MANAGE_TEAM: 'MANAGE_TEAM',
  UPLOAD_DOCUMENTS: 'UPLOAD_DOCUMENTS',
} as const;

export const PermissionActionSchema = z.enum([
  PERMISSION_ACTIONS.DELETE_DOSSIER,
  PERMISSION_ACTIONS.FINAL_APPROVAL,
  PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS,
  PERMISSION_ACTIONS.EXPORT_OFFICIAL_REPORT,
  PERMISSION_ACTIONS.MANAGE_TEAM,
  PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
]);

export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];

/**
 * Kanzlei-Benutzerprofil für die aktive Session.
 */
export const KanzleiUserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  title: z.string().optional(),
  role: NotaryRoleSchema,
  avatarUrl: z.string().url().optional(),
});

export type KanzleiUserProfile = z.infer<typeof KanzleiUserProfileSchema>;

/**
 * Team-Mitglied für API-Responses und Kanzlei-Listen.
 */
export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  title: z.string().optional(),
  role: NotaryRoleSchema,
  joinedAt: z.string().datetime(),
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const InviteMemberRequestSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  email: z.string().email('Gültige E-Mail erforderlich'),
  role: NotaryRoleSchema,
  title: z.string().optional(),
});

export type InviteMemberRequest = z.infer<typeof InviteMemberRequestSchema>;

export const UpdateMemberRoleRequestSchema = z.object({
  role: NotaryRoleSchema,
});

export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;

/**
 * Login-Payload (E-Mail + Passwort oder Magic-Link).
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('Gültige E-Mail-Adresse erforderlich'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen lang sein').optional(),
  redirectTo: z.string().optional(),
});

export const SSO_PROVIDERS = {
  GOOGLE: 'google',
} as const;

export const SsoProviderSchema = z.enum([SSO_PROVIDERS.GOOGLE]);
export type SsoProvider = z.infer<typeof SsoProviderSchema>;

export const SsoLoginRequestSchema = z.object({
  provider: SsoProviderSchema,
  redirectTo: z.string().optional(),
});

export type SsoLoginRequest = z.infer<typeof SsoLoginRequestSchema>;

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Registrierungs-Payload für neue Kanzlei & Inhaber/Notar.
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email('Gültige E-Mail-Adresse erforderlich'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  fullName: z.string().min(2, 'Vollständiger Name erforderlich'),
  title: z.string().optional(),
  organizationName: z.string().min(2, 'Kanzleiname erforderlich'),
  officialSeat: z.string().min(2, 'Amtssitz erforderlich'),
  chamberDistrict: z.string().min(2, 'Notarkammerbezirk erforderlich'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * Authentifizierte Session-Info Response.
 */
export const AuthSessionResponseSchema = z.object({
  user: KanzleiUserProfileSchema,
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    officialSeat: z.string(),
    chamberDistrict: z.string(),
  }),
});

export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
