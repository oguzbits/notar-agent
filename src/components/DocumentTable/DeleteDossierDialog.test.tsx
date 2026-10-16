import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { AxeMatchers } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { DELETION_REASON_LABELS_DE, DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { DELETION_REASONS } from '@/types/deletion';
import { DeleteDossierDialog } from './DeleteDossierDialog';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
}

expect.extend(matchers);

const confirmButton = () => screen.getByRole('button', { name: DELETION_UI_TEXTS_DE.CONFIRM });
const pickReason = () =>
  fireEvent.click(
    screen.getByRole('button', { name: DELETION_REASON_LABELS_DE[DELETION_REASONS.SONSTIGES] })
  );

function setup(onConfirm = vi.fn().mockResolvedValue(true), onClose = vi.fn()) {
  render(
    <DeleteDossierDialog dossierTitle="Kaufvertrag" onConfirm={onConfirm} onClose={onClose} />
  );
  return { onConfirm, onClose };
}

describe('DeleteDossierDialog', () => {
  it('sperrt das Löschen, solange kein Grund gewählt ist', () => {
    const { onConfirm } = setup();
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('übergibt den gewählten Grund und schließt nach Erfolg', async () => {
    const { onConfirm, onClose } = setup();
    pickReason();
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(onConfirm).toHaveBeenCalledWith(DELETION_REASONS.SONSTIGES);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sperrt Steuerelemente, solange gelöscht wird', async () => {
    let resolve: (ok: boolean) => void = () => undefined;
    const pending = new Promise<boolean>((r) => (resolve = r));
    const { onConfirm } = setup(vi.fn().mockReturnValue(pending));
    pickReason();
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => resolve(true));
  });

  it('zeigt bei Fehlschlag eine Meldung mit „Erneut versuchen“ und bleibt offen', async () => {
    const { onConfirm, onClose } = setup(vi.fn().mockResolvedValue(false));
    pickReason();
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(screen.getByRole('alert').textContent).toBe(DELETION_UI_TEXTS_DE.ERROR);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: DELETION_UI_TEXTS_DE.RETRY }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('hat keine Barrierefreiheitsverstöße', async () => {
    setup();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
