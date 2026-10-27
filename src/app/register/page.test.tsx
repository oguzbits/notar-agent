import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import RegisterPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const server = setupServer(
  http.post('/api/auth/register', () =>
    HttpResponse.json({ success: true, emailConfirmationRequired: true }, { status: 201 })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('RegisterPage', () => {
  it('zeigt bei ausstehender E-Mail-Bestätigung den Hinweis statt Weiterleitung', async () => {
    render(<RegisterPage />);

    const fill = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fill(/Vollständiger Name/, 'Dr. Neuer Notar');
    fill(/Amts-E-Mail-Adresse/, 'neu@kanzlei.de');
    fill(/Passwort/, 'Password123!');
    fill(/Kanzleiname/, 'Notariat Neu');
    fill(/Amtssitz/, 'Köln');
    fireEvent.submit(screen.getByRole('button', { name: /Kanzlei/i }).closest('form')!);

    await waitFor(() => expect(screen.getByText('Bitte E-Mail bestätigen')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Zur Anmeldung' })).toBeTruthy();
  });
});
