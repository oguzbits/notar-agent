import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import type { AxeMatchers } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { StatusOverrideReasonModal } from '@/components/FieldCockpit/subcomponents/StatusOverrideReasonModal';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CASE_STATUS } from '@/types/document';
import { FIELD_STATUS } from '@/types/dossier';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion extends AxeMatchers {}
}

expect.extend(matchers);

describe('Accessibility (a11y) automated audits via vitest-axe', () => {
  it('Button has no accessibility violations', async () => {
    const { container } = render(
      <Button variant="primary" size="md">
        Unterlagen prüfen
      </Button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('StatusBadge has no accessibility violations in all variants', async () => {
    const { container } = render(
      <div>
        <StatusBadge status={FIELD_STATUS.VERIFIED} />
        <StatusBadge status={FIELD_STATUS.NEEDS_REVIEW} />
        <StatusBadge status={FIELD_STATUS.OUTDATED} />
        <StatusBadge status={CASE_STATUS.IN_PROGRESS} />
        <StatusBadge status={FIELD_STATUS.MISSING} />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('StatusOverrideReasonModal (Radix Dialog) has no accessibility violations', async () => {
    const { baseElement } = render(
      <StatusOverrideReasonModal
        isOpen={true}
        fieldTitle="Kaufpreis"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    // Dialog.Portal rendert im document.body (baseElement)
    const results = await axe(baseElement);
    expect(results).toHaveNoViolations();
  });
});
