import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
import { RoleBadge } from './RoleBadge';

const mockLogout = vi.fn();
let mockAuthState = {
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
  isLoadingSession: false,
};

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

describe('RoleBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
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
      isLoadingSession: false,
    };
  });

  it('renders skeleton loader while session is loading (zero layout shift)', () => {
    mockAuthState.isLoadingSession = true;
    render(<RoleBadge />);

    const skeleton = screen.getByLabelText('Kanzleistatus wird geladen');
    expect(skeleton).toBeDefined();
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('Dr. Test Notar')).toBeNull();
  });

  it('renders user details and organization in trigger button when loaded', () => {
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
