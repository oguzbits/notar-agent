import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { PRUEFPLAN_UI_TEXTS_DE as T } from '@/lib/dossier/constants';
import { CASE_TYPES } from '@/types/dossier';
import { KNOWLEDGE_REVIEW_STATUS } from '@/types/knowledge';
import { PruefplanDialog } from './PruefplanDialog';

const ID = 'a0000000-0000-4000-8000-00000000000a';
const FILES = [{ name: 'vertrag.pdf', type: 'application/pdf', size: 1 }];

function plan(overrides: object = {}) {
  return {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    fields: [{ fieldKey: 'kaufpreis', title: 'Kaufpreis' }],
    rules: [
      {
        id: ID,
        title: 'Regel Eins',
        legalBasis: 'Norm A',
        reviewStatus: KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT,
      },
    ],
    ruleBasisReviewed: false,
    ...overrides,
  };
}

function setup(onStart = vi.fn(), onCancel = vi.fn()) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PruefplanDialog
        isOpen
        caseType={CASE_TYPES.IMMOBILIENKAUF}
        files={FILES}
        onCancel={onCancel}
        onStart={onStart}
      />
    </QueryClientProvider>
  );
  return { onStart, onCancel };
}

afterEach(() => vi.unstubAllGlobals());

describe('PruefplanDialog', () => {
  it('zeigt Unterlagen, Pflichtangaben, Regeln und den Hinweis zur ungeprüften Regelgrundlage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(plan()))
    );
    setup();

    expect(await screen.findByText('Kaufpreis')).toBeDefined();
    expect(screen.getByText('vertrag.pdf')).toBeDefined();
    expect(screen.getByText(/Regel Eins/)).toBeDefined();
    expect(screen.getByText(T.WARNING)).toBeDefined();
  });

  it('startet nur über „Prüfung starten“ und erst, wenn der Plan geladen ist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(plan()))
    );
    const { onStart } = setup();

    const start = screen.getByRole('button', { name: T.START }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: T.START }) as HTMLButtonElement).disabled).toBe(
        false
      )
    );
    fireEvent.click(screen.getByRole('button', { name: T.START }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('startet bei Abbrechen nichts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(plan()))
    );
    const { onStart, onCancel } = setup();

    await screen.findByText('Kaufpreis');
    fireEvent.click(screen.getByRole('button', { name: T.CANCEL }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('zeigt bei einem Ladefehler eine Meldung mit Wiederholen und erlaubt keinen Start', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValue(Response.json(plan()));
    vi.stubGlobal('fetch', fetchMock);
    setup();

    expect(await screen.findByText(T.ERROR)).toBeDefined();
    expect((screen.getByRole('button', { name: T.START }) as HTMLButtonElement).disabled).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: T.RETRY }));
    expect(await screen.findByText('Kaufpreis')).toBeDefined();
  });

  it('zeigt bei leerer Regelgrundlage einen Hinweis statt einer leeren Liste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(plan({ rules: [] })))
    );
    setup();

    expect(await screen.findByText(T.RULES_EMPTY)).toBeDefined();
    expect(screen.getByText(T.WARNING)).toBeDefined();
  });
});
