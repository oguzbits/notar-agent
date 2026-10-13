import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { DocumentRecord, CASE_STATUS } from '@/types/document';
import { CASE_TYPES, OVERALL_STATUS } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';
import { DocumentTable } from './DocumentTable';

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    hasRolePermission: () => true,
  }),
}));

const mockDoc: DocumentRecord = {
  id: 'doc-1',
  title: 'Kaufvertrag Musterhausen',
  status: CASE_STATUS.IN_PROGRESS,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-01T10:00:00Z',
  content: createTestImmobilienDossier({
    caseTitle: 'Kaufvertrag Musterhausen',
    overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
  }),
};

const mockJob: DossierJob = {
  id: 'job-1',
  status: JOB_STATUS.PROCESSING,
  stage: JOB_STAGES.EXTRACTION,
  progressDetails: {
    currentStep: 2,
    totalSteps: 4,
    currentActivity: 'Textextraktion läuft...',
  },
  payload: {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    notes: 'Laufender Hintergrund-Job',
    files: [{ name: 'Urkunde.pdf', type: 'application/pdf', size: 1024 }],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  retryCount: 0,
  maxRetries: 3,
};

describe('DocumentTable Component', () => {
  it('renders table skeleton with aria-busy when isLoading is true (zero CLS)', () => {
    render(
      <DocumentTable
        documents={[]}
        isLoading={true}
        onSelectDocument={vi.fn()}
        onCreateNew={vi.fn()}
        onDeleteDocument={vi.fn()}
      />
    );

    const skeletonContainer = screen.getByLabelText('Vorgänge werden geladen');
    expect(skeletonContainer).toBeDefined();
    expect(skeletonContainer.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Vorgang / Aktenzeichen')).toBeDefined();
    expect(screen.queryByText('Keine Vorgänge gefunden')).toBeNull();
  });

  it('renders active jobs and documents when loaded', () => {
    const handleSelectJob = vi.fn();
    const handleSelectDoc = vi.fn();

    render(
      <DocumentTable
        documents={[mockDoc]}
        activeJobs={[mockJob]}
        isLoading={false}
        onSelectDocument={handleSelectDoc}
        onSelectJob={handleSelectJob}
        onCreateNew={vi.fn()}
        onDeleteDocument={vi.fn()}
      />
    );

    expect(screen.getByText('Laufender Hintergrund-Job')).toBeDefined();
    expect(screen.getByText('Textextraktion läuft...')).toBeDefined();
    expect(screen.getByText('Kaufvertrag Musterhausen')).toBeDefined();
  });

  it('renders fallback title and handles search filtering across caseTypes and notes', () => {
    const jobWithFallbackTitle: DossierJob = {
      ...mockJob,
      id: 'job-fallback-title',
      payload: {
        ...mockJob.payload,
        caseType: CASE_TYPES.GMBH_GRUENDUNG,
        notes: '',
      },
    };

    render(
      <DocumentTable
        documents={[]}
        activeJobs={[jobWithFallbackTitle]}
        isLoading={false}
        onSelectDocument={vi.fn()}
        onCreateNew={vi.fn()}
        onDeleteDocument={vi.fn()}
      />
    );

    // Fallback-Titel bei leeren Notizen
    expect(screen.getByText('Neuer Urkundenvorgang')).toBeDefined();

    // Suche nach Case-Type filtern
    const searchInput = screen.getByPlaceholderText(/Vorgang oder Aktenzeichen suchen/i);
    fireEvent.change(searchInput, { target: { value: 'GMBH' } });
    expect(screen.getByText('Neuer Urkundenvorgang')).toBeDefined();
  });

  it('renders empty state with Call-To-Action button when no records exist', () => {
    const handleCreateNew = vi.fn();

    render(
      <DocumentTable
        documents={[]}
        activeJobs={[]}
        isLoading={false}
        onSelectDocument={vi.fn()}
        onCreateNew={handleCreateNew}
        onDeleteDocument={vi.fn()}
      />
    );

    expect(screen.getByText('Keine Vorgänge gefunden')).toBeDefined();
    const createBtn = screen.getByText('Erste Akte anlegen');
    expect(createBtn).toBeDefined();

    fireEvent.click(createBtn);
    expect(handleCreateNew).toHaveBeenCalled();
  });

  it('renders cancel button for active job and calls onCancelJob when clicked', async () => {
    const handleCancelJob = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentTable
        documents={[]}
        activeJobs={[mockJob]}
        isLoading={false}
        onSelectDocument={vi.fn()}
        onCreateNew={vi.fn()}
        onDeleteDocument={vi.fn()}
        onCancelJob={handleCancelJob}
      />
    );

    const cancelBtn = screen.getByText('Abbrechen');
    expect(cancelBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
    expect(handleCancelJob).toHaveBeenCalledWith(mockJob.id);
  });

  it('renders failed job with error reason and displays retry button calling onRetryJob', async () => {
    const failedJob: DossierJob = {
      ...mockJob,
      id: 'job-failed-1',
      status: JOB_STATUS.FAILED,
      errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
    };
    const handleRetry = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentTable
        documents={[]}
        activeJobs={[failedJob]}
        isLoading={false}
        onSelectDocument={vi.fn()}
        onCreateNew={vi.fn()}
        onDeleteDocument={vi.fn()}
        onRetryJob={handleRetry}
      />
    );

    expect(
      screen.getByText('Verarbeitung unterbrochen. Bitte Vorgang erneut starten.')
    ).toBeDefined();
    const retryBtn = screen.getByText('Wiederholen');
    expect(retryBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(handleRetry).toHaveBeenCalledWith(failedJob.id);
  });
});
