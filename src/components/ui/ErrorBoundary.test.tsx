import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test-Fehler in Komponente');
  }
  return <div>Normaler Inhalt</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Erfolgreich gerendert</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Erfolgreich gerendert')).toBeDefined();
  });

  it('renders fallback UI and catches error when child throws', () => {
    // Suppress console.error during expected throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Spezifischer Fehler-Titel">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Spezifischer Fehler-Titel')).toBeDefined();
    expect(screen.getByText('Test-Fehler in Komponente')).toBeDefined();

    consoleSpy.mockRestore();
  });
});
