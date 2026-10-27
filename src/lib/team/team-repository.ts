import { SupabaseClient } from '@supabase/supabase-js';
import { TeamMember } from '@/types/auth';
import { DB_TABLES, Database } from '@/types/database';
import { NotaryRole } from '@/types/organization';

/** Eigene SQLSTATEs des Triggers organization_members_guard (Core-Migration); nur diese werden fachlich gedeutet. */
export const TEAM_GUARD_SQLSTATE = {
  SELF_CHANGE: 'TM001',
  LAST_NOTAR: 'TM002',
} as const;

export class TeamSelfChangeError extends Error {
  constructor() {
    super(
      'Die eigene Rolle und Mitgliedschaft können nur von einer anderen berechtigten Person geändert werden.'
    );
    this.name = 'TeamSelfChangeError';
  }
}

export class LastNotarError extends Error {
  constructor() {
    super(
      'Die Kanzlei braucht mindestens einen Notar. Bitte zuerst eine weitere Person zum Notar ernennen.'
    );
    this.name = 'LastNotarError';
  }
}

function memberWriteError(error: { code?: string; message: string }, context: string): Error {
  if (error.code === TEAM_GUARD_SQLSTATE.SELF_CHANGE) return new TeamSelfChangeError();
  if (error.code === TEAM_GUARD_SQLSTATE.LAST_NOTAR) return new LastNotarError();
  return new Error(`${context}: ${error.message}`);
}

export interface ITeamRepository {
  listMembers(organizationId: string): Promise<TeamMember[]>;
  getMemberById(id: string, organizationId: string): Promise<TeamMember | null>;
  updateMemberRole(
    id: string,
    newRole: NotaryRole,
    organizationId: string
  ): Promise<TeamMember | null>;
  removeMember(id: string, organizationId: string): Promise<boolean>;
}

export class SupabaseTeamRepository implements ITeamRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listMembers(organizationId: string): Promise<TeamMember[]> {
    const { data: members, error: membersError } = await this.supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('id, organization_id, user_id, role, joined_at')
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      throw new Error(`Failed to list organization members: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      return [];
    }

    // Hole Profile der zugehörigen Benutzer
    const userIds = members.map((m) => m.user_id).filter(Boolean) as string[];
    let profilesMap = new Map<
      string,
      { full_name: string | null; email: string | null; title: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profiles } = await this.supabase
        .from(DB_TABLES.PROFILES)
        .select('id, full_name, email, title')
        .in('id', userIds);

      if (profiles) {
        profilesMap = new Map(profiles.map((p) => [p.id, p]));
      }
    }

    return members.map((row) => {
      const profile = row.user_id ? profilesMap.get(row.user_id) : undefined;
      return {
        id: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        role: row.role as NotaryRole,
        joinedAt: row.joined_at,
        name: profile?.full_name || 'Kanzleimitglied',
        email: profile?.email || 'mitarbeiter@kanzlei.de',
        title: profile?.title || undefined,
      };
    });
  }

  async getMemberById(id: string, organizationId: string): Promise<TeamMember | null> {
    const { data: member, error } = await this.supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('id, organization_id, user_id, role, joined_at')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get member: ${error.message}`);
    }
    if (!member) return null;

    let profile: { full_name: string | null; email: string | null; title: string | null } | null =
      null;
    if (member.user_id) {
      const { data: p } = await this.supabase
        .from(DB_TABLES.PROFILES)
        .select('full_name, email, title')
        .eq('id', member.user_id)
        .maybeSingle();
      profile = p;
    }

    return {
      id: member.id,
      organizationId: member.organization_id,
      userId: member.user_id,
      role: member.role as NotaryRole,
      joinedAt: member.joined_at,
      name: profile?.full_name || 'Kanzleimitglied',
      email: profile?.email || 'mitarbeiter@kanzlei.de',
      title: profile?.title || undefined,
    };
  }

  async updateMemberRole(
    id: string,
    newRole: NotaryRole,
    organizationId: string
  ): Promise<TeamMember | null> {
    const { data: updated, error } = await this.supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .update({ role: newRole })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id, organization_id, user_id, role, joined_at')
      .maybeSingle();

    if (error) {
      throw memberWriteError(error, 'Failed to update member role');
    }
    if (!updated) return null;

    let profile: { full_name: string | null; email: string | null; title: string | null } | null =
      null;
    if (updated.user_id) {
      const { data: p } = await this.supabase
        .from(DB_TABLES.PROFILES)
        .select('full_name, email, title')
        .eq('id', updated.user_id)
        .maybeSingle();
      profile = p;
    }

    return {
      id: updated.id,
      organizationId: updated.organization_id,
      userId: updated.user_id,
      role: updated.role as NotaryRole,
      joinedAt: updated.joined_at,
      name: profile?.full_name || 'Kanzleimitglied',
      email: profile?.email || 'mitarbeiter@kanzlei.de',
      title: profile?.title || undefined,
    };
  }

  async removeMember(id: string, organizationId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id');

    if (error) {
      throw memberWriteError(error, 'Failed to remove member');
    }
    return (data ?? []).length > 0;
  }
}
