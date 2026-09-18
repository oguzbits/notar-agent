import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog UI Component', () => {
  it('renders title, description and buttons when open', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Vorgang löschen?"
        description="Möchten Sie diesen Vorgang wirklich unwiderruflich löschen?"
      />
    );

    expect(screen.getByText('Vorgang löschen?')).toBeDefined();
    expect(
      screen.getByText('Möchten Sie diesen Vorgang wirklich unwiderruflich löschen?')
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Löschen' })).toBeDefined();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        title="Vorgang löschen?"
        description="Bestätigen"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        title="Vorgang löschen?"
        description="Abbrechen"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('disables buttons and indicates loading when isLoading is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        isLoading={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Vorgang löschen?"
        description="Wird gelöscht..."
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement;
    const confirmButton = screen.getByRole('button', { name: 'Löschen' }) as HTMLButtonElement;

    expect(cancelButton.disabled).toBe(true);
    expect(confirmButton.disabled).toBe(true);
  });
});
