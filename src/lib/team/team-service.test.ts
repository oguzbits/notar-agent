import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockAuditRepository,
  createMockTeamRepository,
} from '@/test/fixtures/mock-repositories';
import { TEST_ORG_ID } from '@/test/fixtures/session-context';
import { AUDIT_ACTIONS } from '@/types/audit';
import { SessionContext } from '@/types/auth';
import { NOTARY_ROLES } from '@/types/organization';
import { LastNotarError } from './team-repository';
import { changeMemberRole, removeMember } from './team-service';

const session: SessionContext = {
  userId: 'c0000000-0000-4000-8000-0000000000c1',
  organizationId: TEST_ORG_ID,
  role: NOTARY_ROLES.NOTAR,
  actorLabel: 'Dr. Muster',
};

describe('Teamänderungen schreiben ein Audit-Ereignis', () => {
  let deps: ReturnType<typeof makeDeps>;
  let memberId: string;

  function makeDeps() {
    return { repo: createMockTeamRepository(), audit: createMockAuditRepository(), session };
  }

  beforeEach(async () => {
    deps = makeDeps();
    const member = deps.repo.seedMember(
      { name: 'Frau Akte', email: 'akte@kanzlei.de', role: NOTARY_ROLES.SACHBEARBEITER },
      TEST_ORG_ID
    );
    memberId = member.id;
  });

  const lastEvent = async () => (await deps.audit.getHistory(`team:${TEST_ORG_ID}`)).at(-1);

  it('Rollenwechsel: den Eintrag schreibt die Datenbank (Trigger), nicht die Anwendung', async () => {
    const updated = await changeMemberRole(deps, memberId, NOTARY_ROLES.NOTARASSESSOR);

    expect(updated?.role).toBe(NOTARY_ROLES.NOTARASSESSOR);
    expect(deps.audit.appendEvent).not.toHaveBeenCalled();
  });

  it('Entfernen: Ziel und bisherige Rolle', async () => {
    expect(await removeMember(deps, memberId)).toBe(true);

    expect(await lastEvent()).toMatchObject({
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      details: { member: { memberId, previousRole: NOTARY_ROLES.SACHBEARBEITER } },
    });
  });

  it('abgelehnte Änderung und unbekanntes Mitglied schreiben kein Ereignis', async () => {
    vi.mocked(deps.repo.updateMemberRole).mockRejectedValueOnce(new LastNotarError());

    await expect(changeMemberRole(deps, memberId, NOTARY_ROLES.ADMIN)).rejects.toThrow(
      LastNotarError
    );
    expect(await changeMemberRole(deps, 'unbekannt', NOTARY_ROLES.ADMIN)).toBeNull();
    expect(await removeMember(deps, 'unbekannt')).toBe(false);
    expect(deps.audit.appendEvent).not.toHaveBeenCalled();
  });
});
