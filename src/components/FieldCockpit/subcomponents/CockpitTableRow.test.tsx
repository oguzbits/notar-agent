import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { FIELD_STATUS, FieldStatus } from '@/types/dossier';
import { CockpitTableRow } from './CockpitTableRow';

function renderRow(status: FieldStatus, onOverride = vi.fn()) {
  render(
    <table>
      <tbody>
        <CockpitTableRow
          row={{
            fieldKey: 'kaufpreis',
            fieldTitle: 'Kaufpreis',
            fieldIndex: 1,
            status,
            note: '',
            sources: [],
          }}
          dossier={createTestImmobilienDossier()}
          isExpanded={false}
          onToggleExpand={() => {}}
          onOverrideFieldStatus={onOverride}
        />
      </tbody>
    </table>
  );
  return onOverride;
}

describe('CockpitTableRow: Statuswechsel nur mit Begründung', () => {
  it.each([FIELD_STATUS.NEEDS_REVIEW, FIELD_STATUS.MISSING])(
    'Wechsel von Belegt auf %s fragt erst die Begründung ab',
    (target) => {
      const onOverride = renderRow(FIELD_STATUS.VERIFIED);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: target } });

      expect(onOverride).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.change(screen.getByLabelText(/Begründung für die Akte/), {
        target: { value: 'Unterlage zurückgezogen' },
      });
      fireEvent.submit(screen.getByLabelText(/Begründung für die Akte/).closest('form')!);

      expect(onOverride).toHaveBeenCalledWith('kaufpreis', target, '', 'Unterlage zurückgezogen');
    }
  );
});
