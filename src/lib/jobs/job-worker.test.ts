import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IJobRepository } from '@/lib/jobs/job-repository';
import { cancelDossierJob, executeDossierJob, WorkerDependencies } from '@/lib/jobs/job-worker';
import { computeJobProgressPercent } from '@/lib/jobs/progress';
import type { IDossierRepository } from '@/lib/supabase/repository';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  createMockAuditRepository,
  createMockJobRepository,
  createMockKnowledgeRepository,
} from '@/test/fixtures/mock-repositories';
import { AUDIT_ACTIONS } from '@/types/audit';
import { CASE_TYPES, STORAGE_TYPES } from '@/types/dossier';
import { JOB_STATUS, JOB_STAGES, type CreateJobPayload } from '@/types/jobs';

function createMockDossierRepo(): IDossierRepository {
  return {
    save: vi.fn(async () => ({
      persisted: true,
      id: 'dossier-mock',
      storageType: STORAGE_TYPES.SUPABASE,
      caseNumber: 'IMMOBILIENKAUF - dossier-',
    })),
    update: vi.fn(async () => ({ success: true })),
    findById: vi.fn(async () => null),
    list: vi.fn(async () => []),
    delete: vi.fn(async (id: string) => ({ documentId: id, deletedRows: {}, storageTasks: 0 })),
  };
}

const ORG_ID = 'a0000000-0000-4000-8000-000000000001';

describe('job-worker (executeDossierJob)', () => {
  let jobRepo: IJobRepository;
  let dossierRepo: IDossierRepository;

  const mockResultDossier = createTestImmobilienDossier();

  beforeEach(() => {
    jobRepo = createMockJobRepository();
    dossierRepo = createMockDossierRepo();
  });

  it('runs successfully through all stages and sets COMPLETED with resultDossierId', async () => {
    const pipelineMock: NonNullable<WorkerDependencies['pipelineFn']> = async ({ onStep }) => {
      onStep(1, 'Dokumente aufbereiten');
      onStep(2, 'Prüfnormen abgleichen');
      return mockResultDossier;
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'scan.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: '',
    });

    const processedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: pipelineMock,
    });

    expect(processedJob?.status).toBe(JOB_STATUS.COMPLETED);
    expect(processedJob?.stage).toBe(JOB_STAGES.PERSISTING);
    expect(processedJob?.progressDetails).toBeDefined();
    expect(processedJob?.progressDetails?.currentStep).toBe(4);
    expect(processedJob?.progressDetails?.totalSteps).toBe(4);
    expect(computeJobProgressPercent(processedJob!)).toBe(100);
    expect(processedJob?.resultDossierId).toBeDefined();
  });

  it('setzt bei Pipeline-Fehler FAILED, gibt die Sperre frei und zählt keinen Versuch (das macht der Requeue)', async () => {
    const failingPipeline: NonNullable<WorkerDependencies['pipelineFn']> = async () => {
      throw new Error('Anthropic API 500');
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
    });

    const failedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: failingPipeline,
    });

    expect(failedJob?.status).toBe(JOB_STATUS.FAILED);
    expect(failedJob?.errorMessage).toContain('Anthropic API 500');
    expect(failedJob?.retryCount).toBe(0);
    expect(failedJob?.lockedAt).toBeUndefined();
  });

  describe('Abbruch', () => {
    const payload: CreateJobPayload = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'vertrag.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: '',
    };
    const extractionFn: NonNullable<WorkerDependencies['extractionFn']> = async () => ({
      parsedExtractionRaw: { fields: {} },
      noteList: [],
      notesSection: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      extractionTextResult: '{}',
      validationSuccess: true,
    });

    it('Abbruch während Stufe 2: Signal erreicht die Stufe, kein Dossier, Status bleibt CANCELLED', async () => {
      const job = await jobRepo.createJob(payload);
      let auditorSignal: AbortSignal | undefined;

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        // Das Modell antwortet trotz Abbruch; nur der Worker darf das Ergebnis verwerfen
        auditorFn: async ({ abortSignal }) => {
          auditorSignal = abortSignal;
          await cancelDossierJob(job.id, { jobRepo });
          return mockResultDossier;
        },
      });

      expect(auditorSignal?.aborted).toBe(true);
      expect(done?.status).toBe(JOB_STATUS.CANCELLED);
      expect(done?.lockedAt).toBeUndefined();
      expect(dossierRepo.save).not.toHaveBeenCalled();
    });

    it('Abbruch aus einer anderen Instanz beim Speichern: Abschluss überschreibt CANCELLED nicht', async () => {
      const job = await jobRepo.createJob(payload);
      vi.mocked(dossierRepo.save).mockImplementationOnce(async () => {
        // Kein AbortController in diesem Prozess: nur der Datenbankstatus ändert sich
        await jobRepo.transitionJob(job.id, [JOB_STATUS.PROCESSING], {
          status: JOB_STATUS.CANCELLED,
        });
        return {
          persisted: true,
          id: 'dossier-mock',
          storageType: STORAGE_TYPES.SUPABASE,
          caseNumber: 'x',
        };
      });

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async () => mockResultDossier,
      });

      expect(done?.status).toBe(JOB_STATUS.CANCELLED);
      expect((await jobRepo.getJobById(job.id))?.status).toBe(JOB_STATUS.CANCELLED);
    });

    it('Abbruch aus einer anderen Instanz während Stufe 2: kein Dossier gespeichert', async () => {
      const job = await jobRepo.createJob(payload);

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async () => {
          await jobRepo.transitionJob(job.id, [JOB_STATUS.PROCESSING], {
            status: JOB_STATUS.CANCELLED,
          });
          return mockResultDossier;
        },
      });

      expect(done?.status).toBe(JOB_STATUS.CANCELLED);
      expect(dossierRepo.save).not.toHaveBeenCalled();
    });

    it('Abbruch aus einer anderen Instanz während Stufe 1: kein Checkpoint, Stufe 2 läuft nicht', async () => {
      const job = await jobRepo.createJob(payload);
      const auditorFn = vi.fn(async () => mockResultDossier);

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn: async (params) => {
          await jobRepo.transitionJob(job.id, [JOB_STATUS.PROCESSING], {
            status: JOB_STATUS.CANCELLED,
          });
          return extractionFn(params);
        },
        auditorFn,
      });

      expect(done?.status).toBe(JOB_STATUS.CANCELLED);
      expect(done?.payload.stage1Output).toBeUndefined();
      expect(auditorFn).not.toHaveBeenCalled();
    });

    it('ein abgeschlossener Job lässt sich nicht mehr abbrechen', async () => {
      const job = await jobRepo.createJob(payload);
      await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async () => mockResultDossier,
      });

      const result = await cancelDossierJob(job.id, { jobRepo });

      expect(result?.status).toBe(JOB_STATUS.COMPLETED);
      expect((await jobRepo.getJobById(job.id))?.status).toBe(JOB_STATUS.COMPLETED);
    });

    it('Abbruch während des Speicherns wird abgelehnt: Dossier und Job bleiben stimmig', async () => {
      const job = await jobRepo.createJob(payload);
      let statusAfterCancel: string | undefined;
      vi.mocked(dossierRepo.save).mockImplementationOnce(async () => {
        statusAfterCancel = (await cancelDossierJob(job.id, { jobRepo }))?.status;
        return {
          persisted: true,
          id: 'dossier-mock',
          storageType: STORAGE_TYPES.SUPABASE,
          caseNumber: 'x',
        };
      });

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async () => mockResultDossier,
      });

      expect(statusAfterCancel).toBe(JOB_STATUS.PROCESSING);
      expect(done?.status).toBe(JOB_STATUS.COMPLETED);
      expect(done?.resultDossierId).toBe('dossier-mock');
    });

    it('ein abgelöster Lauf (Heilung und Neustart) speichert nichts und ändert den neuen Lauf nicht', async () => {
      const job = await jobRepo.createJob(payload);
      const newRunLock = '2099-01-01T00:00:00.000Z';

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async () => {
          // Ein zweiter Lauf hat den Job inzwischen mit eigener Sperrzeit übernommen
          await jobRepo.updateJobStatus(job.id, { lockedAt: newRunLock });
          return mockResultDossier;
        },
      });

      expect(dossierRepo.save).not.toHaveBeenCalled();
      expect(done?.status).toBe(JOB_STATUS.PROCESSING);
      expect(done?.lockedAt).toBe(newRunLock);
    });

    it('ein abgelöster Lauf entfernt beim Ende nicht den Abbruch-Zugriff des neuen Laufs', async () => {
      const job = await jobRepo.createJob(payload);
      let releaseOld!: () => void;
      let releaseNew!: () => void;
      let markOldInStage2!: () => void;
      const oldInStage2 = new Promise<void>((r) => (markOldInStage2 = r));
      let newSignal: AbortSignal | undefined;
      let markNewInStage2!: () => void;
      const newInStage2 = new Promise<void>((r) => (markNewInStage2 = r));

      const oldRun = executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async () => {
          markOldInStage2();
          await new Promise<void>((r) => (releaseOld = r));
          return mockResultDossier;
        },
      });
      await oldInStage2;
      // Eigene Millisekunde, damit der neue Lauf eine andere Sperrzeit (Lauf-Kennung) erhält
      await new Promise((r) => setTimeout(r, 2));
      // Heilung und Wiederholung: der Job wartet wieder und wird vom neuen Lauf übernommen
      await jobRepo.updateJobStatus(job.id, { status: JOB_STATUS.PENDING, lockedAt: null });
      const newRun = executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        auditorFn: async ({ abortSignal }) => {
          newSignal = abortSignal;
          markNewInStage2();
          await new Promise<void>((r) => {
            releaseNew = r;
            abortSignal?.addEventListener('abort', () => r());
          });
          return mockResultDossier;
        },
      });
      await newInStage2;

      releaseOld();
      await oldRun;
      await cancelDossierJob(job.id, { jobRepo });
      const abortedImmediately = newSignal?.aborted;
      releaseNew();
      await newRun;

      expect(abortedImmediately).toBe(true);
      expect((await jobRepo.getJobById(job.id))?.status).toBe(JOB_STATUS.CANCELLED);
    });

    it('Shutdown-Signal zwischen den Stufen: kein Dossier, Job wartet wieder', async () => {
      const job = await jobRepo.createJob(payload);
      const shutdown = new AbortController();

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn,
        abortSignal: shutdown.signal,
        auditorFn: async () => {
          shutdown.abort();
          return mockResultDossier;
        },
      });

      expect(done?.status).toBe(JOB_STATUS.PENDING);
      expect(dossierRepo.save).not.toHaveBeenCalled();
    });

    it('reicht das Abbruchsignal an die Extraktion durch', async () => {
      const job = await jobRepo.createJob(payload);
      const extraction = vi.fn(extractionFn);

      await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        extractionFn: extraction,
        auditorFn: async () => mockResultDossier,
      });

      expect(extraction.mock.calls[0]?.[0].abortSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('Fortschritt', () => {
    it('ein verspätetes Fortschritts-Update ändert einen abgeschlossenen Job nicht', async () => {
      let lateStep: ((step: number, detail: string) => void) | undefined;
      const job = await jobRepo.createJob({
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: '',
      });

      await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        pipelineFn: async ({ onStep }) => {
          lateStep = onStep;
          return mockResultDossier;
        },
      });
      lateStep?.(1, 'verspätet');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const after = await jobRepo.getJobById(job.id);
      expect(after?.status).toBe(JOB_STATUS.COMPLETED);
      expect(after?.stage).toBe(JOB_STAGES.PERSISTING);
      expect(after?.progressDetails?.currentStep).toBe(4);
    });

    it('ein Datenbankfehler im Fortschritt wird protokolliert und bricht den Lauf nicht ab', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const original = vi.mocked(jobRepo.transitionJob).getMockImplementation()!;
      vi.mocked(jobRepo.transitionJob).mockImplementation(async (id, from, update, org) => {
        if (update.stage === JOB_STAGES.EXTRACTION) throw new Error('Datenbank nicht erreichbar');
        return original(id, from, update, org);
      });
      const job = await jobRepo.createJob({
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: '',
      });

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        pipelineFn: async ({ onStep }) => {
          onStep(1, 'Dokumente aufbereiten');
          await new Promise((resolve) => setTimeout(resolve, 0));
          return mockResultDossier;
        },
      });

      expect(done?.status).toBe(JOB_STATUS.COMPLETED);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('fortschritt_fehlgeschlagen'));
      warn.mockRestore();
    });
  });

  it('cancels active job via cancelDossierJob and sets status to CANCELLED', async () => {
    const slowPipeline: NonNullable<WorkerDependencies['pipelineFn']> = async ({ onStep }) => {
      onStep(1, 'Dokumente aufbereiten');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5000);
      });
      return mockResultDossier;
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: 'Abbruch-Test',
    });

    // Start background execution
    const executionPromise = executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: slowPipeline,
    });

    // Abbruch anfordern
    const cancelResult = await cancelDossierJob(job.id, { jobRepo });
    expect(cancelResult).not.toBeNull();
    expect(cancelResult?.status).toBe(JOB_STATUS.CANCELLED);

    const finishedJob = await executionPromise;
    expect(finishedJob?.status).toBe(JOB_STATUS.CANCELLED);
  });

  it('runs 2-stage chunking: executes Stage 1, checkpoints stage1Output to DB, and completes Stage 2', async () => {
    const stage1OutputMock = { extractedParties: ['Käufer Schmidt'], rawFacts: {} };
    const extractionMock = vi.fn(async () => ({
      parsedExtractionRaw: stage1OutputMock,
      noteList: [],
      notesSection: '',
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
      extractionTextResult: JSON.stringify(stage1OutputMock),
      validationSuccess: true,
    }));

    const auditorMock = vi.fn(async () => mockResultDossier);
    const sessionKnowledgeRepo = createMockKnowledgeRepository();

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'kaufvertrag.pdf', size: 200, type: 'application/pdf', content: 'test' }],
      notes: 'Testnotiz',
    });

    const finishedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      extractionFn: extractionMock,
      auditorFn: auditorMock,
      knowledgeRepo: sessionKnowledgeRepo,
    });

    expect(extractionMock).toHaveBeenCalledTimes(1);
    expect(auditorMock).toHaveBeenCalledTimes(1);
    expect(auditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage1Output: stage1OutputMock,
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        knowledgeRepo: sessionKnowledgeRepo,
      })
    );

    expect(finishedJob?.status).toBe(JOB_STATUS.COMPLETED);
    expect(finishedJob?.payload.stage1Output).toEqual(stage1OutputMock);
    expect(dossierRepo.save).toHaveBeenCalledTimes(1);
  });

  it('skips Stage 1 when stage1Output checkpoint already exists in job payload', async () => {
    const existingCheckpoint = { preExtracted: true, testField: 'value' };
    const extractionMock = vi.fn();
    const auditorMock = vi.fn(async () => mockResultDossier);

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
      stage1Output: existingCheckpoint,
    });

    const finishedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      extractionFn: extractionMock,
      auditorFn: auditorMock,
    });

    // Stufe 1 darf NICHT erneut aufgerufen werden
    expect(extractionMock).not.toHaveBeenCalled();
    // Stufe 2 wird direkt mit dem existierenden Checkpoint ausgeführt
    expect(auditorMock).toHaveBeenCalledTimes(1);
    expect(auditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage1Output: existingCheckpoint,
      })
    );

    expect(finishedJob?.status).toBe(JOB_STATUS.COMPLETED);
  });

  it('führt einen nicht wartenden Job nicht aus (kein Doppellauf)', async () => {
    const pipeline = vi.fn(async () => mockResultDossier);
    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
    });
    await jobRepo.updateJobStatus(job.id, { status: JOB_STATUS.PROCESSING });

    const result = await executeDossierJob(job.id, { jobRepo, dossierRepo, pipelineFn: pipeline });

    expect(pipeline).not.toHaveBeenCalled();
    expect(result?.status).toBe(JOB_STATUS.PROCESSING);
  });

  describe('Prüfgrundlage im Audit-Trail', () => {
    const pipelineFn: NonNullable<WorkerDependencies['pipelineFn']> = async () => mockResultDossier;
    const payload: CreateJobPayload = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'vertrag.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: '',
    };

    it('schreibt nach dem Speichern genau einen Eintrag mit Unterlagen und Regel-IDs', async () => {
      const auditRepo = createMockAuditRepository();
      const knowledgeRepo = createMockKnowledgeRepository();
      const rules = await knowledgeRepo.getStatutoryRules(ORG_ID);
      const job = await jobRepo.createJob(payload, ORG_ID);

      const done = await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        auditRepo,
        knowledgeRepo,
        pipelineFn,
      });

      expect(auditRepo.appendEvent).toHaveBeenCalledTimes(1);
      const call = vi.mocked(auditRepo.appendEvent).mock.calls[0]?.[0];
      expect(call?.action).toBe(AUDIT_ACTIONS.DOCUMENT_INGESTED);
      expect(call?.documentId).toBe(done?.resultDossierId);
      expect(call?.organizationId).toBe(ORG_ID);
      expect(call?.details?.pruefgrundlage).toEqual({
        fileNames: ['vertrag.pdf'],
        ruleIds: rules.map((r) => r.id),
      });
    });

    it('schreibt bei einem fehlgeschlagenen Lauf keinen Eintrag', async () => {
      const auditRepo = createMockAuditRepository();
      const job = await jobRepo.createJob(payload, ORG_ID);

      await executeDossierJob(job.id, {
        jobRepo,
        dossierRepo,
        auditRepo,
        pipelineFn: async () => {
          throw new Error('Modellfehler');
        },
      });

      expect(auditRepo.appendEvent).not.toHaveBeenCalled();
    });

    it('lässt den Job abgeschlossen, wenn der Audit-Eintrag scheitert (kein Doppel-Dossier bei Wiederholung)', async () => {
      const auditRepo = createMockAuditRepository();
      vi.mocked(auditRepo.appendEvent).mockRejectedValueOnce(
        new Error('Audit-DB nicht erreichbar')
      );
      const job = await jobRepo.createJob(payload, ORG_ID);

      const done = await executeDossierJob(job.id, { jobRepo, dossierRepo, auditRepo, pipelineFn });

      expect(done?.status).toBe(JOB_STATUS.COMPLETED);
    });
  });
});
