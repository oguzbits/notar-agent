import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { Input } from './Input';

describe('Input Component', () => {
  it('renders input with label and standard base typography', () => {
    render(<Input id="test-input" label="Kanzlei-E-Mail" />);

    const label = screen.getByText('Kanzlei-E-Mail');
    expect(label).toBeDefined();
    expect(label.className).toContain('text-base');

    const input = screen.getByRole('textbox');
    expect(input).toBeDefined();
    expect(input.className).toContain('text-base');
  });

  it('renders error message with accessibility attributes', () => {
    render(<Input id="error-input" label="Passwort" error="Passwort ist erforderlich" />);

    const errorMessage = screen.getByText('Passwort ist erforderlich');
    expect(errorMessage).toBeDefined();
    expect(errorMessage.getAttribute('role')).toBe('alert');

    const input = screen.getByLabelText('Passwort');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('renders helper text when provided', () => {
    render(<Input id="helper-input" label="Name" helperText="Vor- und Nachname angeben" />);

    expect(screen.getByText('Vor- und Nachname angeben')).toBeDefined();
  });
});

describe('Card Component', () => {
  it('renders card and its subcomponents with semantic classes', () => {
    render(
      <Card data-testid="card-root">
        <CardHeader>
          <CardTitle>Titel der Karte</CardTitle>
          <CardDescription>Beschreibungstext</CardDescription>
        </CardHeader>
        <CardContent>Inhalt der Karte</CardContent>
        <CardFooter>Footer Aktionen</CardFooter>
      </Card>
    );

    const root = screen.getByTestId('card-root');
    expect(root.className).toContain('bg-card');
    expect(root.className).toContain('border-border');

    const title = screen.getByText('Titel der Karte');
    expect(title.className).toContain('text-foreground');
    expect(title.className).toContain('font-bold');

    const desc = screen.getByText('Beschreibungstext');
    expect(desc.className).toContain('text-muted-foreground');
  });
});
