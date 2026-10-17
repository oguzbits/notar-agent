import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePendingDeletions } from '@/hooks/usePendingDeletions';
import { DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { PendingDeletionNotice } from './PendingDeletionNotice';

vi.mock('@/hooks/usePendingDeletions', () => ({ usePendingDeletions: vi.fn() }));

const state = (over: Partial<ReturnType<typeof usePendingDeletions>>) =>
  vi.mocked(usePendingDeletions).mockReturnValue({
    pendingFiles: 0,
    isLoading: false,
    isError: false,
    retry: vi.fn(),
    ...over,
  } as never);

describe('PendingDeletionNotice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('zeigt nichts, wenn keine Löschung offen ist', () => {
    state({});
    const { container } = render(<PendingDeletionNotice organizationId="org" />);
    expect(container.firstChild).toBeNull();
  });

  it('zeigt beim ersten Laden einen Platzhalter', () => {
    state({ isLoading: true });
    render(<PendingDeletionNotice organizationId="org" />);
    expect(screen.getByText(DELETION_UI_TEXTS_DE.PENDING_LOADING)).toBeTruthy();
  });

  it.each([
    [1, 'Löschung läuft: 1 Datei wird noch entfernt.'],
    [4, 'Löschung läuft: 4 Dateien werden noch entfernt.'],
  ])('nennt bei %i offenen Dateien den Stand', (pendingFiles, text) => {
    state({ pendingFiles });
    render(<PendingDeletionNotice organizationId="org" />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('bietet bei Fehler einen Wiederholen-Knopf', () => {
    const retry = vi.fn();
    state({ isError: true, retry });
    render(<PendingDeletionNotice organizationId="org" />);
    expect(screen.getByRole('alert').textContent).toContain(DELETION_UI_TEXTS_DE.PENDING_ERROR);
    fireEvent.click(screen.getByRole('button', { name: DELETION_UI_TEXTS_DE.RETRY }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
