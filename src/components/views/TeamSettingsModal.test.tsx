import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ROLE_LABELS_DE } from '@/lib/auth/role-labels';
import { NOTARY_ROLES, type NotaryRole } from '@/types/organization';
import { TeamSettingsModal } from './TeamSettingsModal';

const mockUpdateOrganization = vi.fn();
const mockInviteMember = vi.fn();
const mockUpdateMemberRole = vi.fn();
const mockRemoveMember = vi.fn();

const mockOrganization = {
  id: 'org-123',
  name: 'Notariat Dr. Muster',
  officialSeat: 'Münster',
  chamberDistrict: 'Westfälische Notarkammer',
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

const mockCurrentUser = {
  id: 'user-1',
  name: 'Dr. Test Notar',
  email: 'notar@test.de',
  role: NOTARY_ROLES.NOTAR,
};

const mockTeamMembers = [
  mockCurrentUser,
  {
    id: 'user-2',
    name: 'Max Mustermann',
    email: 'max@test.de',
    role: NOTARY_ROLES.SACHBEARBEITER,
  },
];

const session = { role: mockCurrentUser.role as NotaryRole };

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    organization: mockOrganization,
    currentUser: { ...mockCurrentUser, role: session.role },
    teamMembers: mockTeamMembers,
    updateOrganization: mockUpdateOrganization,
    inviteMember: mockInviteMember,
    updateMemberRole: mockUpdateMemberRole,
    removeMember: mockRemoveMember,
    hasRolePermission: () => true,
  }),
}));

vi.mock('@/hooks/useTeam', () => ({
  useTeam: () => ({
    members: mockTeamMembers,
    isLoading: false,
    isError: false,
    error: null,
    inviteMember: mockInviteMember,
    updateMemberRole: mockUpdateMemberRole,
    removeMember: mockRemoveMember,
    invalidate: vi.fn(),
  }),
}));

describe('TeamSettingsModal', () => {
  it('renders settings modal with tabs and pre-filled organization stammdaten', () => {
    render(<TeamSettingsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Kanzlei-Einstellungen')).toBeDefined();
    expect(screen.getByRole('button', { name: /Kanzlei-Stammdaten/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Team & Rollen/i })).toBeDefined();

    const nameInput = screen.getByLabelText(/Kanzleiname \/ Notariat/i) as HTMLInputElement;
    const seatInput = screen.getByLabelText(/Amtssitz/i) as HTMLInputElement;
    const districtInput = screen.getByLabelText(/Notarkammerbezirk/i) as HTMLInputElement;

    expect(nameInput.value).toBe('Notariat Dr. Muster');
    expect(seatInput.value).toBe('Münster');
    expect(districtInput.value).toBe('Westfälische Notarkammer');
  });

  it('allows updating organization stammdaten', async () => {
    mockUpdateOrganization.mockResolvedValueOnce({});
    render(<TeamSettingsModal isOpen={true} onClose={vi.fn()} />);

    const nameInput = screen.getByLabelText(/Kanzleiname \/ Notariat/i);
    fireEvent.change(nameInput, { target: { value: 'Notariat Neuer Name' } });

    const saveBtn = screen.getByRole('button', { name: /Änderungen speichern/i });
    fireEvent.click(saveBtn);

    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      name: 'Notariat Neuer Name',
      officialSeat: 'Münster',
      chamberDistrict: 'Westfälische Notarkammer',
    });
  });

  it('switches to Team & Rollen tab and displays members', () => {
    render(<TeamSettingsModal isOpen={true} onClose={vi.fn()} />);

    const teamTab = screen.getByRole('button', { name: /Team & Rollen/i });
    fireEvent.click(teamTab);

    expect(screen.getByText('Max Mustermann')).toBeDefined();
    expect(screen.getByText('max@test.de')).toBeDefined();
    expect(screen.getByRole('button', { name: /Mitarbeiter einladen/i })).toBeDefined();
  });

  it.each([
    [NOTARY_ROLES.NOTAR, true],
    [NOTARY_ROLES.ADMIN, false],
  ])('Rolle %s: Rolle Notar in der Auswahl angeboten = %s', (role, offered) => {
    session.role = role;
    render(<TeamSettingsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Team & Rollen/i }));

    const memberSelect = screen.getByDisplayValue(ROLE_LABELS_DE[NOTARY_ROLES.SACHBEARBEITER]);
    const labels = Array.from(memberSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels.includes(ROLE_LABELS_DE[NOTARY_ROLES.NOTAR])).toBe(offered);
    session.role = NOTARY_ROLES.NOTAR;
  });
});
