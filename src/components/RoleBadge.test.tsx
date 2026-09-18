import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { RoleBadge } from './RoleBadge';

const mockLogout = vi.fn();

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    organization: {
      id: 'org-1',
      name: 'Notariat Mitte',
      officialSeat: 'Berlin',
      chamberDistrict: 'Notarkammer Berlin',
    },
    hasActiveOrganization: true,
    currentUser: {
      id: 'user-1',
      name: 'Dr. Test Notar',
      email: 'notar@kanzlei.de',
      role: NOTARY_ROLES.NOTAR,
    },
    logout: mockLogout,
  }),
}));

describe('RoleBadge', () => {
  it('renders user details and organization in trigger button', () => {
    render(<RoleBadge />);

    expect(screen.getByText('Dr. Test Notar')).toBeDefined();
    expect(screen.getByText('Notar / Notarin (Amtsinhaber)')).toBeDefined();
    expect(screen.getByText(/Notariat Mitte • Berlin/i)).toBeDefined();
  });

  it('opens dropdown and does NOT display dead controls like "Benutzer wechseln" or "Rolle testen"', () => {
    render(<RoleBadge />);

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    expect(screen.getByText('Notariat Mitte')).toBeDefined();
    expect(screen.getByText(/Berlin • Notarkammer Berlin/i)).toBeDefined();
    expect(screen.getByText('notar@kanzlei.de')).toBeDefined();
    expect(screen.getByText(/Volle Beurkundungs- & Siegelbefugnis/i)).toBeDefined();

    // Zero Pseudo-Controls Invariant: kein "Benutzer wechseln" oder "Rolle testen"
    expect(screen.queryByText('Benutzer wechseln')).toBeNull();
    expect(screen.queryByText('Rolle testen')).toBeNull();

    // Abmelden Action ist vorhanden
    expect(screen.getByText('Abmelden')).toBeDefined();
  });
});
