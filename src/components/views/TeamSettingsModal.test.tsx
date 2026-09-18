import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NOTARY_ROLES } from '@/types/organization';
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

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    organization: mockOrganization,
    currentUser: mockCurrentUser,
    teamMembers: mockTeamMembers,
    updateOrganization: mockUpdateOrganization,
    inviteMember: mockInviteMember,
    updateMemberRole: mockUpdateMemberRole,
    removeMember: mockRemoveMember,
    hasRolePermission: () => true,
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
});
