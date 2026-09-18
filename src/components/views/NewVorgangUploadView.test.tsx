import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NewVorgangUploadView } from './NewVorgangUploadView';

describe('NewVorgangUploadView Component', () => {
  it('renders heading, upload zone and action buttons', () => {
    render(
      <NewVorgangUploadView
        files={[]}
        onFilesChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        errorMessage={null}
        onClearError={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Neuer Urkundenvorgang')).toBeDefined();
    const submitButton = screen.getByRole('button', {
      name: 'Unterlagen prüfen',
    }) as HTMLButtonElement;
    expect(submitButton).toBeDefined();
    expect(submitButton.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Muster-Kaufvertrag laden' })).toBeDefined();
  });

  it('loads sample mock files when "Muster-Kaufvertrag laden" is clicked', () => {
    const handleFilesChange = vi.fn();
    const handleNotesChange = vi.fn();

    render(
      <NewVorgangUploadView
        files={[]}
        onFilesChange={handleFilesChange}
        notes=""
        onNotesChange={handleNotesChange}
        errorMessage={null}
        onClearError={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Muster-Kaufvertrag laden' }));

    expect(handleFilesChange).toHaveBeenCalledTimes(1);
    expect(handleNotesChange).toHaveBeenCalledTimes(1);
    const firstCall = handleFilesChange.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall) {
      expect(firstCall[0].length).toBeGreaterThan(0);
    }
  });
});
