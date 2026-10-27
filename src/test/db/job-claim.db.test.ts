import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SupabaseJobRepository } from '@/lib/jobs/job-repository';
import { DB_TABLES } from '@/types/database';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STAGES, JOB_STATUS } from '@/types/jobs';
import { NOTARY_ROLES } from '@/types/organization';
import { createDbHarness, TestUser } from './db-harness';

const harness = createDbHarness();

let owner: TestUser;
let orgId: string;
let repo: SupabaseJobRepository;

beforeAll(async () => {
  owner = await harness.createUser();
  orgId = await harness.createOrganizationWithMember(owner.id, NOTARY_ROLES.NOTAR);
  repo = new SupabaseJobRepository(owner.client);
});

const newJob = () =>
  repo.createJob({ caseType: CASE_TYPES.IMMOBILIENKAUF, files: [], notes: randomUUID() }, orgId);

describe('Atomarer Statusübergang (transitionJob)', () => {
  it('Bei gleichzeitigem Zugriff gewinnt genau ein Aufrufer', async () => {
    const job = await newJob();
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        repo.transitionJob(
          job.id,
          [JOB_STATUS.PENDING],
          { status: JOB_STATUS.PROCESSING },
          {
            organizationId: orgId,
          }
        )
      )
    );
    expect(attempts.filter((a) => a !== null)).toHaveLength(1);
  });

  it('Ein Job in anderem Ausgangsstatus wird nicht verändert', async () => {
    const job = await newJob();
    await repo.updateJobStatus(job.id, { status: JOB_STATUS.COMPLETED });
    const result = await repo.transitionJob(
      job.id,
      [JOB_STATUS.FAILED],
      { status: JOB_STATUS.PENDING },
      { organizationId: orgId }
    );
    expect(result).toBeNull();
    expect((await repo.getJobById(job.id, orgId))?.status).toBe(JOB_STATUS.COMPLETED);
  });
});

describe('Zusatzbedingungen (Lauf-Kennung, Stufe, Kanzlei)', () => {
  it('ändert nur mit passender Sperrzeit, nicht in der ausgeschlossenen Stufe, nur in der eigenen Kanzlei', async () => {
    const job = await newJob();
    const lockedAt = new Date().toISOString();
    await repo.updateJobStatus(job.id, { status: JOB_STATUS.PROCESSING, lockedAt });
    const touch = { progressDetails: { currentStep: 2, totalSteps: 4 } };
    const otherRun = new Date(Date.now() - 60_000).toISOString();

    expect(
      await repo.transitionJob(job.id, [JOB_STATUS.PROCESSING], touch, { lockedAt: otherRun })
    ).toBeNull();
    expect(
      await repo.transitionJob(job.id, [JOB_STATUS.PROCESSING], touch, {
        organizationId: randomUUID(),
      })
    ).toBeNull();
    // Ohne Stufe zählt die Bedingung als erfüllt
    expect(
      await repo.transitionJob(job.id, [JOB_STATUS.PROCESSING], touch, {
        lockedAt,
        stageNot: JOB_STAGES.PERSISTING,
      })
    ).not.toBeNull();

    await repo.updateJobStatus(job.id, { stage: JOB_STAGES.PERSISTING });
    expect(
      await repo.transitionJob(job.id, [JOB_STATUS.PROCESSING], touch, {
        stageNot: JOB_STAGES.PERSISTING,
      })
    ).toBeNull();
  });
});

describe('Felder löschen (null)', () => {
  it('null entfernt Sperre und alte Fehlermeldung', async () => {
    const job = await newJob();
    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.FAILED,
      errorMessage: 'alter Fehler',
      lockedAt: new Date().toISOString(),
    });
    const requeued = await repo.transitionJob(
      job.id,
      [JOB_STATUS.FAILED],
      { status: JOB_STATUS.PENDING, errorMessage: null, lockedAt: null },
      { organizationId: orgId }
    );
    expect(requeued?.errorMessage).toBeUndefined();
    expect(requeued?.lockedAt).toBeUndefined();
  });
});

describe('Heilung veralteter Jobs (recoverOrphanJobs)', () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
  const setRow = async (id: string, row: Record<string, unknown>) => {
    const { error } = await harness.admin.from(DB_TABLES.DOSSIER_JOBS).update(row).eq('id', id);
    if (error) throw new Error(error.message);
  };

  it('setzt nur PROCESSING/PENDING-Jobs ohne Lebenszeichen auf FAILED', async () => {
    const [staleProcessing, aliveWithOldLock, stalePending, oldButRequeued, completed] =
      await Promise.all([newJob(), newJob(), newJob(), newJob(), newJob()]);
    await setRow(staleProcessing.id, {
      status: JOB_STATUS.PROCESSING,
      locked_at: minutesAgo(10),
      updated_at: minutesAgo(10),
    });
    // Sperre alt, aber Fortschritt hat updated_at gerade erneuert: läuft noch
    await setRow(aliveWithOldLock.id, {
      status: JOB_STATUS.PROCESSING,
      locked_at: minutesAgo(10),
      updated_at: minutesAgo(0),
    });
    await setRow(stalePending.id, { updated_at: minutesAgo(10) });
    // Vor langer Zeit angelegt, aber gerade erneut eingereiht
    await setRow(oldButRequeued.id, { created_at: minutesAgo(30), updated_at: minutesAgo(0) });
    await setRow(completed.id, { status: JOB_STATUS.COMPLETED, updated_at: minutesAgo(10) });

    const healed = await repo.recoverOrphanJobs(3 * 60 * 1000, orgId);

    const statusOf = async (id: string) => (await repo.getJobById(id, orgId))?.status;
    expect(healed).toBe(2);
    expect(await statusOf(staleProcessing.id)).toBe(JOB_STATUS.FAILED);
    expect(await statusOf(stalePending.id)).toBe(JOB_STATUS.FAILED);
    expect(await statusOf(aliveWithOldLock.id)).toBe(JOB_STATUS.PROCESSING);
    expect(await statusOf(oldButRequeued.id)).toBe(JOB_STATUS.PENDING);
    expect(await statusOf(completed.id)).toBe(JOB_STATUS.COMPLETED);
    const failed = await repo.getJobById(staleProcessing.id, orgId);
    expect(failed?.lockedAt).toBeUndefined();
    expect(failed?.retryCount).toBe(0);
  });
});
