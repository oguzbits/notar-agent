import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import type { AxeMatchers } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

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
        <StatusBadge status="VERIFIED" />
        <StatusBadge status="NEEDS_REVIEW" />
        <StatusBadge status="OUTDATED" />
        <StatusBadge status="In Prüfung" />
        <StatusBadge status="MISSING" />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
