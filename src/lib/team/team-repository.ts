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

/** RLS verweigert die Änderung (SQLSTATE 42501), z. B. wenn ein ADMIN die Rolle NOTAR vergeben will. */
export class TeamRoleNotPermittedError extends Error {
  constructor() {
    super(
      'Diese Änderung ist mit Ihrer Rolle nicht erlaubt. Die Rolle Notar vergibt nur ein Notar.'
    );
    this.name = 'TeamRoleNotPermittedError';
  }
}

function memberWriteError(error: { code?: string; message: string }, context: string): Error {
  if (error.code === TEAM_GUARD_SQLSTATE.SELF_CHANGE) return new TeamSelfChangeError();
  if (error.code === TEAM_GUARD_SQLSTATE.LAST_NOTAR) return new LastNotarError();
  if (error.code === '42501') return new TeamRoleNotPermittedError();
  return new Error(`${context}: ${error.message}`);
}

const MEMBER_COLUMNS = 'id, organization_id, user_id, role, joined_at';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  title: string | null;
}

interface MemberRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  role: string;
  joined_at: string;
}

function toTeamMember(row: MemberRow, profiles: Map<string, ProfileRow>): TeamMember {
  const profile = row.user_id ? profiles.get(row.user_id) : undefined;
  if (!row.user_id || !profile) {
    throw new Error(`Profil des Mitglieds ${row.id} nicht lesbar.`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role as NotaryRole,
    joinedAt: row.joined_at,
    name: profile.full_name || profile.email,
    email: profile.email,
    title: profile.title || undefined,
  };
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
      .select(MEMBER_COLUMNS)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      throw new Error(`Failed to list organization members: ${membersError.message}`);
    }

    const rows = members ?? [];
    const profiles = await this.loadProfiles(rows.map((m) => m.user_id));
    return rows.map((row) => toTeamMember(row, profiles));
  }

  async getMemberById(id: string, organizationId: string): Promise<TeamMember | null> {
    const { data: member, error } = await this.supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select(MEMBER_COLUMNS)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get member: ${error.message}`);
    }
    if (!member) return null;
    return toTeamMember(member, await this.loadProfiles([member.user_id]));
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
      .select(MEMBER_COLUMNS)
      .maybeSingle();

    if (error) {
      throw memberWriteError(error, 'Failed to update member role');
    }
    if (!updated) return null;
    return toTeamMember(updated, await this.loadProfiles([updated.user_id]));
  }

  /** Profile der Mitglieder; Kollegen derselben Kanzlei sind per RLS lesbar, Fehler werden nicht verdeckt. */
  private async loadProfiles(userIds: (string | null)[]): Promise<Map<string, ProfileRow>> {
    const ids = userIds.filter((id): id is string => id !== null);
    if (ids.length === 0) return new Map();
    const { data, error } = await this.supabase
      .from(DB_TABLES.PROFILES)
      .select('id, full_name, email, title')
      .in('id', ids);
    if (error) {
      throw new Error(`Failed to load member profiles: ${error.message}`);
    }
    return new Map((data ?? []).map((p) => [p.id, p]));
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
