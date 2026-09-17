import { ITeamRepository } from '@/lib/team/team-repository';
import { TeamMember, InviteMemberRequest } from '@/types/auth';
import { NotaryRole } from '@/types/organization';

export class InMemoryTeamRepository implements ITeamRepository {
  private members: Map<string, TeamMember> = new Map();

  constructor(initialMembers: TeamMember[] = []) {
    for (const m of initialMembers) {
      this.members.set(m.id, { ...m });
    }
  }

  async listMembers(organizationId: string): Promise<TeamMember[]> {
    return Array.from(this.members.values())
      .filter((m) => m.organizationId === organizationId)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async getMemberById(id: string, organizationId: string): Promise<TeamMember | null> {
    const member = this.members.get(id);
    if (!member || member.organizationId !== organizationId) {
      return null;
    }
    return { ...member };
  }

  async updateMemberRole(
    id: string,
    newRole: NotaryRole,
    organizationId: string
  ): Promise<TeamMember | null> {
    const member = await this.getMemberById(id, organizationId);
    if (!member) return null;

    const updated: TeamMember = { ...member, role: newRole };
    this.members.set(id, updated);
    return { ...updated };
  }

  async inviteMember(data: InviteMemberRequest, organizationId: string): Promise<TeamMember> {
    const id = crypto.randomUUID();
    const newMember: TeamMember = {
      id,
      organizationId,
      userId: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      role: data.role,
      title: data.title,
      joinedAt: new Date().toISOString(),
    };
    this.members.set(id, newMember);
    return { ...newMember };
  }

  async removeMember(id: string, organizationId: string): Promise<boolean> {
    const member = await this.getMemberById(id, organizationId);
    if (!member) return false;
    return this.members.delete(id);
  }
}
