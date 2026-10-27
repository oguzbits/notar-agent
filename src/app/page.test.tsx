import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UEBERSICHT_FEHLER_TEXTS_DE } from '@/lib/dossier/constants';
import { JOB_STATUS } from '@/types/jobs';
import Home from './page';

let search = '';
const jobsHook = vi.fn();
const jobHook = vi.fn();
const docsHook = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/hooks/useJobs', () => ({
  useJobs: () => jobsHook(),
  useJob: () => jobHook(),
}));
vi.mock('@/hooks/useDocuments', () => ({
  useDocuments: () => docsHook(),
  useDocument: () => ({ document: null, isLoadingDocument: false }),
}));
vi.mock('@/hooks/useAnalysisWorkflow', () => ({
  useAnalysisWorkflow: () => ({ setErrorMessage: vi.fn(), errorMessage: null }),
}));
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    currentUser: { id: 'u1' },
    organization: { id: 'org-1' },
    hasActiveOrganization: true,
    isLoadingSession: false,
  }),
}));
vi.mock('@/components/Header', () => ({ Header: () => null }));
vi.mock('@/components/views/TeamSettingsModal', () => ({ TeamSettingsModal: () => null }));
vi.mock('@/components/views/OrganizationGatewayModal', () => ({
  OrganizationGatewayModal: () => null,
}));
vi.mock('@/components/DocumentTable', () => ({
  DocumentTable: () => <div>Tabelle</div>,
}));
vi.mock('@/components/views/JobProgressView', () => ({
  JobProgressView: ({ job }: { job: { status: string } }) => <div>Fortschritt {job.status}</div>,
}));

const baseJobs = {
  jobs: [],
  activeJobs: [],
  failedJobs: [],
  isLoadingJobs: false,
  jobsError: null,
  jobActionError: null,
  clearJobActionError: vi.fn(),
  loadJobs: vi.fn(),
  retryJob: vi.fn(),
  cancelJob: vi.fn(),
  deleteJob: vi.fn(),
  isRetrying: false,
  isCancelling: false,
  isDeletingJob: false,
};
const baseDocs = {
  documents: [],
  isLoadingDocs: false,
  loadDocuments: vi.fn(),
  loadError: null,
  deleteDocument: vi.fn(),
};

beforeEach(() => {
  search = '';
  jobsHook.mockReset();
  jobHook.mockReset();
  docsHook.mockReset();
  jobsHook.mockReturnValue({ ...baseJobs });
  jobHook.mockReturnValue({ job: null, isLoading: false });
  docsHook.mockReturnValue({ ...baseDocs });
});

describe('Vorgangsübersicht Zustände', () => {
  it('zeigt bei Ladefehler eine Meldung mit Wiederholen statt einer leeren Tabelle', () => {
    const loadDocuments = vi.fn();
    const loadJobs = vi.fn();
    docsHook.mockReturnValue({ ...baseDocs, loadError: new Error('x'), loadDocuments });
    jobsHook.mockReturnValue({ ...baseJobs, loadJobs });
    render(<Home />);

    expect(screen.getByRole('alert').textContent).toContain('konnten nicht geladen werden');
    expect(screen.queryByText('Tabelle')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: UEBERSICHT_FEHLER_TEXTS_DE.RETRY }));
    expect(loadDocuments).toHaveBeenCalled();
    expect(loadJobs).toHaveBeenCalled();
  });

  it('zeigt Fehler von Vorgangsaktionen und lässt sie schließen', () => {
    const clearJobActionError = vi.fn();
    jobsHook.mockReturnValue({
      ...baseJobs,
      jobActionError: 'Der Vorgang kann nicht mehr abgebrochen werden.',
      clearJobActionError,
    });
    render(<Home />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Der Vorgang kann nicht mehr abgebrochen werden.'
    );
    expect(screen.getByText('Tabelle')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: UEBERSICHT_FEHLER_TEXTS_DE.DISMISS }));
    expect(clearJobActionError).toHaveBeenCalled();
  });
});

describe('Vorgangsansicht für Hintergrund-Jobs', () => {
  it('zeigt die Nicht-gefunden-Ansicht statt eines erfundenen Jobs, wenn der Job unbekannt ist', () => {
    search = 'job=unbekannt';
    render(<Home />);

    expect(screen.getByText('Hintergrund-Vorgang nicht gefunden')).toBeTruthy();
    expect(screen.queryByText(/Fortschritt/)).toBeNull();
  });

  it('zeigt während des Ladens einen Platzhalter-Job', () => {
    search = 'job=neu';
    jobHook.mockReturnValue({ job: null, isLoading: true });
    render(<Home />);

    expect(screen.getByText(`Fortschritt ${JOB_STATUS.PENDING}`)).toBeTruthy();
  });
});
