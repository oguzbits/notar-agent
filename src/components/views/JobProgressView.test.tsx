import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';
import { JobProgressView } from './JobProgressView';

describe('JobProgressView Component', () => {
  const mockJob: DossierJob = {
    id: 'job-999',
    status: JOB_STATUS.PROCESSING,
    stage: JOB_STAGES.EXTRACTION,
    progressDetails: {
      currentStep: 2,
      totalSteps: 4,
      currentActivity: 'Extraktion der Grundbuchangaben...',
    },
    payload: {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [
        {
          name: 'kaufvertrag.pdf',
          size: 204800,
          type: 'application/pdf',
          content: 'data:application/pdf;base64,abc',
          isBase64: true,
        },
      ],
      notes: 'Kaufvertrag Müller / Schmidt',
    },
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders case title, active activity and file list', () => {
    render(<JobProgressView job={mockJob} onBackToTable={vi.fn()} />);

    expect(screen.getByText(/Kaufvertrag Müller \/ Schmidt/i)).toBeDefined();
    expect(screen.getAllByText(/Extraktion der Grundbuchangaben/i).length).toBeGreaterThan(0);
    expect(screen.getByText('kaufvertrag.pdf')).toBeDefined();
    expect(screen.getByText(/200 KB/i)).toBeDefined();
  });

  it('renders failure notice and retry button when job is FAILED', () => {
    const failedJob: DossierJob = {
      ...mockJob,
      status: JOB_STATUS.FAILED,
      errorMessage: 'Dokument konnte nicht dekodiert werden.',
    };
    const onRetry = vi.fn();

    render(<JobProgressView job={failedJob} onBackToTable={vi.fn()} onRetryJob={onRetry} />);

    expect(screen.getByText('Prüflauf fehlgeschlagen')).toBeDefined();
    expect(screen.getByText('Dokument konnte nicht dekodiert werden.')).toBeDefined();
    expect(screen.getByText('Prüfung wiederholen')).toBeDefined();
  });
});
