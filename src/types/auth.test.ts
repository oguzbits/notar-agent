import { describe, it, expect } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { LoginRequestSchema, RegisterRequestSchema, AuthSessionResponseSchema } from './auth';

describe('Auth Contracts (Zod Schemas)', () => {
  it('validates a valid LoginRequest with password', () => {
    const valid = {
      email: 'notar@kanzlei-berlin.de',
      password: 'securePassword123!',
    };
    const parsed = LoginRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates a valid LoginRequest for magic link (without password)', () => {
    const valid = {
      email: 'notar@kanzlei-berlin.de',
    };
    const parsed = LoginRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email in LoginRequest', () => {
    const invalid = {
      email: 'not-an-email',
      password: 'password123',
    };
    const parsed = LoginRequestSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates a complete RegisterRequest', () => {
    const valid = {
      email: 'notar@kanzlei-muenster.de',
      password: 'SuperSecretPassword!',
      fullName: 'Dr. Notar Mustermann',
      title: 'Notar a.D.',
      organizationName: 'Notariat Mustermann & Kollegen',
      officialSeat: 'Münster',
      chamberDistrict: 'Westfälische Notarkammer',
    };
    const parsed = RegisterRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects RegisterRequest with password less than 8 chars', () => {
    const invalid = {
      email: 'notar@kanzlei-muenster.de',
      password: 'short',
      fullName: 'Dr. Notar',
      organizationName: 'Notariat',
      officialSeat: 'Münster',
      chamberDistrict: 'Westfalen',
    };
    const parsed = RegisterRequestSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates AuthSessionResponseSchema correctly', () => {
    const validSession = {
      user: {
        id: 'a0000000-0000-4000-8000-000000000001',
        name: 'Justus Jonas',
        email: 'justus@kanzlei.de',
        role: NOTARY_ROLES.NOTAR,
      },
      organization: {
        id: 'b0000000-0000-4000-8000-000000000002',
        name: 'Notariat Rocky Beach',
        officialSeat: 'Rocky Beach',
        chamberDistrict: 'Kalifornische Notarkammer',
      },
    };
    const parsed = AuthSessionResponseSchema.safeParse(validSession);
    expect(parsed.success).toBe(true);
  });
});
