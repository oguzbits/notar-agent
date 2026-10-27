import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SupabaseJobRepository } from '@/lib/jobs/job-repository';
import { DB_TABLES } from '@/types/database';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_RATE_LIMIT } from '@/types/jobs';
import { LLM_USAGE_STAGES } from '@/types/llm-usage';
import { NOTARY_ROLES } from '@/types/organization';
import { createDbHarness, type TestUser } from './db-harness';

/** Stundenkontingent: Hintergrund-Jobs und Live-Läufe zählen gemeinsam, jeder Lauf genau einmal. */
describe('Kontingent der Analysen je Kanzlei', () => {
  const harness = createDbHarness();
  let owner: TestUser;
  let orgId: string;
  let repo: SupabaseJobRepository;
  const since = () => new Date(Date.now() - JOB_RATE_LIMIT.WINDOW_MS).toISOString();

  /** Verbrauchszeilen eines Laufs: Extraktion samt Korrekturdurchgang und Prüfung. */
  const recordRun = async (organizationId: string, runId: string, client = owner.client) => {
    const rows = [
      LLM_USAGE_STAGES.EXTRACTION,
      LLM_USAGE_STAGES.EXTRACTION,
      LLM_USAGE_STAGES.AUDIT,
    ].map((stage) => ({
      organization_id: organizationId,
      job_id: runId,
      stage,
      model: 'testmodell',
      input_tokens: 1,
      output_tokens: 1,
    }));
    const { error } = await client.from(DB_TABLES.LLM_USAGE).insert(rows);
    expect(error).toBeNull();
  };

  beforeEach(async () => {
    owner = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(owner.id, NOTARY_ROLES.NOTAR);
    repo = new SupabaseJobRepository(owner.client);
  });

  it('nur Live-Läufe bis zum Limit: das Kontingent ist erschöpft', async () => {
    for (let i = 0; i < JOB_RATE_LIMIT.MAX_JOBS_PER_WINDOW; i++) {
      await recordRun(orgId, `live:${randomUUID()}`);
    }

    expect(await repo.countAnalysisRunsSince(orgId, since())).toBe(
      JOB_RATE_LIMIT.MAX_JOBS_PER_WINDOW
    );
  });

  it('ein Hintergrund-Job zählt einmal, auch mit eigenen Verbrauchszeilen', async () => {
    const job = await repo.createJob(
      { caseType: CASE_TYPES.IMMOBILIENKAUF, files: [], notes: 'Kontingent' },
      orgId
    );
    await recordRun(orgId, job.id);
    await recordRun(orgId, `live:${randomUUID()}`);

    expect(await repo.countAnalysisRunsSince(orgId, since())).toBe(2);
  });

  it('Läufe einer anderen Kanzlei zählen nicht', async () => {
    const other = await harness.createUser();
    const otherOrg = await harness.createOrganizationWithMember(other.id, NOTARY_ROLES.NOTAR);
    await recordRun(otherOrg, `live:${randomUUID()}`, other.client);

    expect(await repo.countAnalysisRunsSince(orgId, since())).toBe(0);
  });
});
