import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SupabaseJobRepository } from '@/lib/jobs/job-repository';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS } from '@/types/jobs';
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
        repo.transitionJob(job.id, [JOB_STATUS.PENDING], { status: JOB_STATUS.PROCESSING }, orgId)
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
      orgId
    );
    expect(result).toBeNull();
    expect((await repo.getJobById(job.id, orgId))?.status).toBe(JOB_STATUS.COMPLETED);
  });
});
