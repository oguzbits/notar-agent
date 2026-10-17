import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { NewVorgangUploadView } from './NewVorgangUploadView';

const render = (ui: React.ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('NewVorgangUploadView Component', () => {
  it('renders heading, upload zone and action buttons', () => {
    render(
      <NewVorgangUploadView
        caseType={CASE_TYPES.IMMOBILIENKAUF}
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
        caseType={CASE_TYPES.IMMOBILIENKAUF}
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

  it('displays staged files when passed in files prop', () => {
    const stagedFiles = [
      {
        name: 'Kaufvertragsentwurf_Muster.txt',
        type: 'text/plain',
        size: 2048,
        content: 'Musterinhalt',
        isBase64: false,
      },
    ];

    render(
      <NewVorgangUploadView
        caseType={CASE_TYPES.IMMOBILIENKAUF}
        files={stagedFiles}
        onFilesChange={vi.fn()}
        notes="Notiz"
        onNotesChange={vi.fn()}
        errorMessage={null}
        onClearError={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Kaufvertragsentwurf_Muster.txt')).toBeDefined();
    expect(screen.getByText(/Ausgewählte Dokumente \(1\)/)).toBeDefined();
    const submitButton = screen.getByRole('button', {
      name: 'Unterlagen prüfen',
    }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });
});
