import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrganizationGatewayModal } from './OrganizationGatewayModal';

const mockCreateOrganization = vi.fn();

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    createOrganization: mockCreateOrganization,
  }),
}));

describe('OrganizationGatewayModal', () => {
  it('renders modal with both tabs and form fields when open', () => {
    render(<OrganizationGatewayModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Kanzlei einrichten oder beitreten')).toBeDefined();
    expect(screen.getByText('Kanzlei gründen')).toBeDefined();
    expect(screen.getByText('Kanzlei beitreten')).toBeDefined();
    expect(screen.getByLabelText(/Name der Kanzlei/i)).toBeDefined();
  });

  it('switches between create and join tabs', () => {
    render(<OrganizationGatewayModal isOpen={true} onClose={vi.fn()} />);

    const joinTab = screen.getByRole('button', { name: /Kanzlei beitreten/i });
    fireEvent.click(joinTab);

    expect(screen.getByText('Bestehendem Team beitreten')).toBeDefined();
  });

  it('submits form with valid data', async () => {
    mockCreateOrganization.mockResolvedValueOnce({});
    const handleClose = vi.fn();

    render(<OrganizationGatewayModal isOpen={true} onClose={handleClose} />);

    fireEvent.change(screen.getByLabelText(/Name der Kanzlei/i), {
      target: { value: 'Notariat Mitte' },
    });
    fireEvent.change(screen.getByLabelText(/Amtssitz/i), {
      target: { value: 'Berlin' },
    });
    fireEvent.change(screen.getByLabelText(/Notarkammerbezirk/i), {
      target: { value: 'Notarkammer Berlin' },
    });

    const submitBtn = screen.getByRole('button', { name: /Kanzlei anlegen & starten/i });
    fireEvent.click(submitBtn);

    expect(mockCreateOrganization).toHaveBeenCalledWith({
      name: 'Notariat Mitte',
      officialSeat: 'Berlin',
      chamberDistrict: 'Notarkammer Berlin',
    });
  });
});
