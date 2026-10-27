import type { IAuditRepository } from '@/lib/audit/audit-repository';
import { AUDIT_ACTIONS, AuditAction, AuditLogDetails } from '@/types/audit';
import { SessionContext, TeamMember } from '@/types/auth';
import { NotaryRole } from '@/types/organization';
import type { ITeamRepository } from './team-repository';

export interface TeamServiceDeps {
  repo: ITeamRepository;
  audit: IAuditRepository;
  session: SessionContext;
}

/** Teamereignisse bilden je Kanzlei eine eigene Hash-Kette (Akte `team:<Kanzlei>`). */
async function appendTeamEvent(
  { audit, session }: TeamServiceDeps,
  action: AuditAction,
  member: NonNullable<AuditLogDetails['member']>
): Promise<void> {
  await audit.appendEvent({
    documentId: `team:${session.organizationId}`,
    organizationId: session.organizationId,
    action,
    actor: session.actorLabel,
    details: { member, actorRole: session.role },
  });
}

/** Ändert die Rolle; Selbständerung und letzter NOTAR lehnt die Datenbank ab (Fehler aus dem Repository). */
export async function changeMemberRole(
  deps: TeamServiceDeps,
  memberId: string,
  newRole: NotaryRole
): Promise<TeamMember | null> {
  const orgId = deps.session.organizationId;
  const before = await deps.repo.getMemberById(memberId, orgId);
  if (!before) return null;
  const { userId, role: previousRole } = before;
  const updated = await deps.repo.updateMemberRole(memberId, newRole, orgId);
  if (!updated) return null;
  await appendTeamEvent(deps, AUDIT_ACTIONS.MEMBER_ROLE_CHANGED, {
    memberId,
    userId,
    previousRole,
    newRole,
  });
  return updated;
}

export async function removeMember(deps: TeamServiceDeps, memberId: string): Promise<boolean> {
  const orgId = deps.session.organizationId;
  const before = await deps.repo.getMemberById(memberId, orgId);
  if (!before || !(await deps.repo.removeMember(memberId, orgId))) return false;
  await appendTeamEvent(deps, AUDIT_ACTIONS.MEMBER_REMOVED, {
    memberId,
    userId: before.userId,
    previousRole: before.role,
  });
  return true;
}
