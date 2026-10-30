import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SupabaseJobRepository } from '@/lib/jobs/job-repository';
import { DB_TABLES } from '@/types/database';
import { CASE_TYPES } from '@/types/dossier';
import { DEMO_ANALYSIS_LIMIT, JOB_RATE_LIMIT } from '@/types/jobs';
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

  describe('Demo-Kanzleien (anonyme Mitglieder)', () => {
    const daySince = () => new Date(Date.now() - DEMO_ANALYSIS_LIMIT.WINDOW_MS).toISOString();

    it('reguläre Kanzlei ist keine Demo-Kanzlei, ihre Läufe zählen nicht in die Obergrenze', async () => {
      await recordRun(orgId, `live:${randomUUID()}`);

      expect(await repo.getDemoAnalysisUsage(orgId, daySince())).toEqual({
        isDemo: false,
        organizationRuns: 0,
        totalRuns: expect.any(Number),
      });
    });

    it('anonyme Kanzlei: zählt eigene Läufe und die Läufe aller Demo-Kanzleien', async () => {
      const demo = await harness.createAnonymousUser();
      const demoOrg = await harness.createOrganizationWithMember(demo.id, NOTARY_ROLES.NOTAR);
      const before = (
        await new SupabaseJobRepository(demo.client).getDemoAnalysisUsage(demoOrg, daySince())
      ).totalRuns;
      await recordRun(demoOrg, `live:${randomUUID()}`, demo.client);
      await recordRun(demoOrg, `live:${randomUUID()}`, demo.client);

      expect(
        await new SupabaseJobRepository(demo.client).getDemoAnalysisUsage(demoOrg, daySince())
      ).toEqual({
        isDemo: true,
        organizationRuns: 2,
        totalRuns: before + 2,
      });
    });

    it('fremde Kanzlei: kein Zugriff auf Demo-Status und Zähler', async () => {
      await expect(repo.getDemoAnalysisUsage(randomUUID(), daySince())).rejects.toThrow();
    });
  });
});
