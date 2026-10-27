import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { JOB_LIST_LIMIT, SupabaseJobRepository } from '@/lib/jobs/job-repository';
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

describe('Übersicht (listJobs)', () => {
  it('liefert Anzeigefelder, aber weder Dateiinhalt noch Zwischenergebnis', async () => {
    const job = await repo.createJob(
      {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        notes: 'Kaufvertrag Müller',
        files: [
          { name: 'a.pdf', type: 'application/pdf', size: 3, content: 'QUJD', isBase64: true },
        ],
        stage1Output: { geheim: 'Zwischenergebnis' },
      },
      orgId
    );
    const listed = (await repo.listJobs(orgId)).find((j) => j.id === job.id);
    expect(listed?.payload.notes).toBe('Kaufvertrag Müller');
    expect(listed?.payload.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
    expect(listed?.payload.files).toEqual([
      { name: 'a.pdf', type: 'application/pdf', size: 3, isBase64: true },
    ]);
    expect(listed?.payload.stage1Output).toBeUndefined();
  });

  it('begrenzt die Anzahl auf JOB_LIST_LIMIT, neueste zuerst', async () => {
    const ownerB = await harness.createUser();
    const orgB = await harness.createOrganizationWithMember(ownerB.id, NOTARY_ROLES.NOTAR);
    const repoB = new SupabaseJobRepository(ownerB.client);
    const rows = Array.from({ length: JOB_LIST_LIMIT + 1 }, (_, i) => ({
      id: randomUUID(),
      organization_id: orgB,
      status: JOB_STATUS.PENDING,
      payload: { caseType: CASE_TYPES.IMMOBILIENKAUF, files: [], notes: `n${i}` },
      created_at: new Date(Date.now() - (JOB_LIST_LIMIT - i) * 1000).toISOString(),
    }));
    const { error } = await harness.admin.from(DB_TABLES.DOSSIER_JOBS).insert(rows);
    if (error) throw new Error(error.message);

    const listed = await repoB.listJobs(orgB);
    expect(listed).toHaveLength(JOB_LIST_LIMIT);
    expect(listed[0]?.payload.notes).toBe(`n${JOB_LIST_LIMIT}`);
  });
});

describe('Aufbewahrung beendeter Vorgänge (pruneCompletedJobs)', () => {
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
  const setRow = async (id: string, row: Record<string, unknown>) => {
    const { error } = await harness.admin.from(DB_TABLES.DOSSIER_JOBS).update(row).eq('id', id);
    if (error) throw new Error(error.message);
  };
  const exists = async (id: string) => (await repo.getJobById(id, orgId)) !== null;

  it('löscht nur alte Endzustände (auch fehlgeschlagene mit offenen Wiederholungen); frische und laufende bleiben', async () => {
    const [oldDone, oldCancelled, oldFailedFinal, freshDone, oldRunning, oldPending, oldRetryable] =
      await Promise.all([newJob(), newJob(), newJob(), newJob(), newJob(), newJob(), newJob()]);
    const old = { updated_at: daysAgo(30) };
    await setRow(oldDone.id, { ...old, status: JOB_STATUS.COMPLETED });
    await setRow(oldCancelled.id, { ...old, status: JOB_STATUS.CANCELLED });
    await setRow(oldFailedFinal.id, { ...old, status: JOB_STATUS.FAILED, retry_count: 3 });
    await setRow(freshDone.id, { status: JOB_STATUS.COMPLETED });
    await setRow(oldRunning.id, { ...old, status: JOB_STATUS.PROCESSING });
    await setRow(oldPending.id, old);
    await setRow(oldRetryable.id, { ...old, status: JOB_STATUS.FAILED, retry_count: 1 });

    const admin = new SupabaseJobRepository(harness.admin);
    await admin.pruneCompletedJobs();

    expect(
      await Promise.all(
        [oldDone, oldCancelled, oldFailedFinal, oldRetryable].map((j) => exists(j.id))
      )
    ).toEqual([false, false, false, false]);
    expect(await Promise.all([freshDone, oldRunning, oldPending].map((j) => exists(j.id)))).toEqual(
      [true, true, true]
    );
  });
});
