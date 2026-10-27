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
import { changeMemberRole, inviteMember, removeMember } from './team-service';

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
    const member = await deps.repo.inviteMember(
      { name: 'Frau Akte', email: 'akte@kanzlei.de', role: NOTARY_ROLES.SACHBEARBEITER },
      TEST_ORG_ID
    );
    memberId = member.id;
  });

  const lastEvent = async () => (await deps.audit.getHistory(`team:${TEST_ORG_ID}`)).at(-1);

  it('Rollenwechsel: Akteur, Ziel, alte und neue Rolle', async () => {
    await changeMemberRole(deps, memberId, NOTARY_ROLES.NOTARASSESSOR);

    expect(await lastEvent()).toMatchObject({
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      organizationId: TEST_ORG_ID,
      actor: 'Dr. Muster',
      details: {
        actorRole: NOTARY_ROLES.NOTAR,
        member: {
          memberId,
          previousRole: NOTARY_ROLES.SACHBEARBEITER,
          newRole: NOTARY_ROLES.NOTARASSESSOR,
        },
      },
    });
  });

  it('Entfernen: Ziel und bisherige Rolle', async () => {
    expect(await removeMember(deps, memberId)).toBe(true);

    expect(await lastEvent()).toMatchObject({
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      details: { member: { memberId, previousRole: NOTARY_ROLES.SACHBEARBEITER } },
    });
  });

  it('Einladen: neues Mitglied und Rolle', async () => {
    const invited = await inviteMember(deps, {
      name: 'Herr Vollzug',
      email: 'vollzug@kanzlei.de',
      role: NOTARY_ROLES.NOTAR,
    });

    expect(await lastEvent()).toMatchObject({
      action: AUDIT_ACTIONS.MEMBER_INVITED,
      details: { member: { memberId: invited.id, newRole: NOTARY_ROLES.NOTAR } },
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
