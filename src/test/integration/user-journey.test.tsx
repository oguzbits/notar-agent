import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentTable } from '@/components/DocumentTable/DocumentTable';
import { JobProgressView } from '@/components/views/JobProgressView';
import { NewVorgangUploadView } from '@/components/views/NewVorgangUploadView';
import { STAGE_ACTIVITY_LABELS_DE } from '@/lib/dossier/constants';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_STATUS, DocumentRecord } from '@/types/document';
import { CASE_TYPES, UploadedFilePayload } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';

// Mock AuthProvider with full Sachbearbeiter/Notar permissions
vi.mock('@/providers/AuthProvider', () => ({
  useAuth: () => ({
    currentUser: { id: 'user-notar-1', name: 'Dr. Justitia', email: 'notar@kanzlei.de' },
    organization: { id: 'org-test-1', name: 'Kanzlei Notariat' },
    hasActiveOrganization: true,
    isLoadingSession: false,
    hasRolePermission: () => true,
  }),
}));

describe('User Journey Integration Suite: Vorgangslebenszyklus & Fehlerbehandlung', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  function TestWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('Journey 1: Neuer Vorgang — Vorlage laden, Dokumentenanzeige prüfen und Analyse anstoßen', async () => {
    const stagedFiles: UploadedFilePayload[] = [
      {
        name: 'Kaufvertragsentwurf_Muster.txt',
        type: 'text/plain',
        size: 4096,
        content: 'Musterinhalt',
        isBase64: false,
      },
    ];

    let filesState = stagedFiles;
    const onFilesChange = vi.fn((newFiles) => {
      filesState = newFiles;
    });
    const onSubmit = vi.fn();

    const { rerender } = render(
      <TestWrapper>
        <NewVorgangUploadView
          files={filesState}
          onFilesChange={onFilesChange}
          notes="Dringender Beurkundungstermin am Freitag"
          onNotesChange={vi.fn()}
          errorMessage={null}
          onClearError={vi.fn()}
          onSubmit={onSubmit}
        />
      </TestWrapper>
    );

    // 1. Verifiziere: Staged-Dateiname und Zähler sind sofort sichtbar
    expect(screen.getByText('Kaufvertragsentwurf_Muster.txt')).toBeDefined();
    expect(screen.getByText(/Ausgewählte Dokumente \(1\)/)).toBeDefined();

    // 2. Submit-Button ist aktiv (nicht disabled)
    const submitBtn = screen.getByRole('button', {
      name: 'Unterlagen prüfen',
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    // 3. User klickt Submit
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // 4. User entfernt Datei -> Liste aktualisiert sich
    const removeBtn = screen.getByTitle('Datei entfernen');
    fireEvent.click(removeBtn);
    expect(onFilesChange).toHaveBeenCalledWith([]);

    rerender(
      <TestWrapper>
        <NewVorgangUploadView
          files={[]}
          onFilesChange={onFilesChange}
          notes=""
          onNotesChange={vi.fn()}
          errorMessage={null}
          onClearError={vi.fn()}
          onSubmit={onSubmit}
        />
      </TestWrapper>
    );

    // Jetzt ist der Submit-Button deaktiviert, da keine Dateien vorhanden sind
    const disabledSubmit = screen.getByRole('button', {
      name: 'Unterlagen prüfen',
    }) as HTMLButtonElement;
    expect(disabledSubmit.disabled).toBe(true);
  });

  it('Journey 2: Job-Fortschritt & Timeout/Fehler-Recovery (Wiederholen & Löschen)', async () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn().mockResolvedValue(true);
    const onDelete = vi.fn().mockResolvedValue(true);
    const onBack = vi.fn();

    // Simuliere einen Job, dessen Server-Timeout überschritten wurde
    const failedJob: DossierJob = {
      id: 'job-timeout-999',
      status: JOB_STATUS.FAILED,
      stage: JOB_STAGES.EXTRACTION,
      errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
        currentActivity: 'Urkunden- & Sachverhaltserfassung läuft...',
      },
      payload: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        notes: '6 Dokumente hochgeladen',
        files: [],
      },
      retryCount: 1,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(
      <TestWrapper>
        <JobProgressView
          job={failedJob}
          onRetryJob={onRetry}
          onCancelJob={onCancel}
          onDeleteJob={onDelete}
          onBackToTable={onBack}
        />
      </TestWrapper>
    );

    // 1. Verifiziere: Fehlerstatus und notarielle Meldung sind deutlich sichtbar
    expect(screen.getByText('Prüflauf fehlgeschlagen')).toBeDefined();
    expect(
      screen.getByText('Verarbeitung unterbrochen. Bitte Vorgang erneut starten.')
    ).toBeDefined();

    // 2. Verifiziere: Wiederholen-Button ist vorhanden und funktionsfähig
    const retryBtn = screen.getByRole('button', { name: /Prüfung wiederholen/i });
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith('job-timeout-999');

    // 3. Verifiziere: Vorgang verwerfen öffnet Bestätigungsdialog und führt Löschung aus
    const deleteBtn = screen.getAllByRole('button', { name: /Vorgang verwerfen/i })[0]!;
    expect(deleteBtn).toBeDefined();
    fireEvent.click(deleteBtn);

    // Klick auf endgültiges Löschen im Bestätigungsdialog
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Ja, Vorgang löschen' });
    fireEvent.click(confirmDeleteBtn);
    expect(onDelete).toHaveBeenCalledWith('job-timeout-999');
  });

  it('Journey 3: Haupttabelle — Parallele Darstellung von aktiven Jobs, Fehlern und Dokumenten mit Aktionen', async () => {
    const onRetryJob = vi.fn().mockResolvedValue(true);
    const onCancelJob = vi.fn().mockResolvedValue(true);
    const onDeleteJob = vi.fn().mockResolvedValue(true);
    const onSelectDoc = vi.fn();
    const onSelectJob = vi.fn();

    const activeJob: DossierJob = {
      id: 'job-active-1',
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.PAGE_SPLITTING,
      progressDetails: {
        currentStep: 1,
        totalSteps: 4,
        currentActivity: STAGE_ACTIVITY_LABELS_DE.PAGE_SPLITTING,
      },
      payload: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        notes: 'Vorgang in Bearbeitung',
        files: [],
      },
      retryCount: 0,
      maxRetries: 3,
      createdAt: '2026-10-13T10:00:00Z',
      updatedAt: '2026-10-13T10:01:00Z',
    };

    const failedJob: DossierJob = {
      id: 'job-failed-2',
      status: JOB_STATUS.FAILED,
      stage: JOB_STAGES.EXTRACTION,
      errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
        currentActivity: 'Urkunden- & Sachverhaltserfassung läuft...',
      },
      payload: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        notes: 'Fehlgeschlagener Vorgang',
        files: [],
      },
      retryCount: 1,
      maxRetries: 3,
      createdAt: '2026-10-13T09:00:00Z',
      updatedAt: '2026-10-13T09:05:00Z',
    };

    const completedDoc: DocumentRecord = {
      id: 'doc-completed-3',
      title: 'Kaufvertrag Lindenthal',
      status: CASE_STATUS.DRAFT_READY,
      content: createTestImmobilienDossier({ caseTitle: 'Kaufvertrag Lindenthal' }),
      created_at: '2026-10-12T14:00:00Z',
      updated_at: '2026-10-12T14:30:00Z',
    };

    render(
      <TestWrapper>
        <DocumentTable
          documents={[completedDoc]}
          activeJobs={[activeJob, failedJob]}
          isLoading={false}
          onSelectDocument={onSelectDoc}
          onSelectJob={onSelectJob}
          onCreateNew={vi.fn()}
          onDeleteDocument={vi.fn()}
          onRetryJob={onRetryJob}
          onCancelJob={onCancelJob}
          onDeleteJob={onDeleteJob}
        />
      </TestWrapper>
    );

    // 1. Alle Einträge sind in der Tabelle sichtbar
    expect(screen.getByText('Vorgang in Bearbeitung')).toBeDefined();
    expect(screen.getByText('Fehlgeschlagener Vorgang')).toBeDefined();
    expect(screen.getByText('Kaufvertrag Lindenthal')).toBeDefined();

    // 2. Aktiver Job zeigt Abbrechen-Aktion
    const cancelActionBtn = screen.getByRole('button', { name: /Abbrechen/i });
    expect(cancelActionBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(cancelActionBtn);
    });
    expect(onCancelJob).toHaveBeenCalledWith('job-active-1');

    // 3. Fehlgeschlagener Job zeigt Wiederholen-Aktion
    const retryActionBtn = screen.getByRole('button', { name: /Wiederholen/i });
    expect(retryActionBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(retryActionBtn);
    });
    expect(onRetryJob).toHaveBeenCalledWith('job-failed-2');

    // 4. Klick auf fertiges Dokument öffnet die Detailansicht
    const docRow = screen.getByText('Kaufvertrag Lindenthal');
    await act(async () => {
      fireEvent.click(docRow);
    });
    expect(onSelectDoc).toHaveBeenCalledWith(completedDoc);
  });
});
