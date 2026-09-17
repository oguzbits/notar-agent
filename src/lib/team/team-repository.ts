import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { TeamMember, InviteMemberRequest } from '@/types/auth';
import { NotaryRole, NotaryRoleSchema } from '@/types/organization';

export interface ITeamRepository {
  listMembers(organizationId: string): Promise<TeamMember[]>;
  getMemberById(id: string, organizationId: string): Promise<TeamMember | null>;
  updateMemberRole(
    id: string,
    newRole: NotaryRole,
    organizationId: string
  ): Promise<TeamMember | null>;
  inviteMember(data: InviteMemberRequest, organizationId: string): Promise<TeamMember>;
  removeMember(id: string, organizationId: string): Promise<boolean>;
}

const OrgMemberRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: NotaryRoleSchema,
  joined_at: z.string(),
  profiles: z
    .object({
      full_name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

type OrgMemberRow = z.infer<typeof OrgMemberRowSchema>;

export class SupabaseTeamRepository implements ITeamRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listMembers(organizationId: string): Promise<TeamMember[]> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select(
        'id, organization_id, user_id, role, joined_at, profiles:user_id(full_name, email, title)'
      )
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list organization members: ${error.message}`);
    }

    const parsedRows = z.array(OrgMemberRowSchema).safeParse(data || []);
    const rows: OrgMemberRow[] = parsedRows.success ? parsedRows.data : [];

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      name: row.profiles?.full_name || 'Kanzleimitglied',
      email: row.profiles?.email || 'mitarbeiter@kanzlei.de',
      title: row.profiles?.title || undefined,
    }));
  }

  async getMemberById(id: string, organizationId: string): Promise<TeamMember | null> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select(
        'id, organization_id, user_id, role, joined_at, profiles:user_id(full_name, email, title)'
      )
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get member: ${error.message}`);
    }
    if (!data) return null;

    const parsed = OrgMemberRowSchema.safeParse(data);
    if (!parsed.success) return null;
    const row = parsed.data;

    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      name: row.profiles?.full_name || 'Kanzleimitglied',
      email: row.profiles?.email || 'mitarbeiter@kanzlei.de',
      title: row.profiles?.title || undefined,
    };
  }

  async updateMemberRole(
    id: string,
    newRole: NotaryRole,
    organizationId: string
  ): Promise<TeamMember | null> {
    const { data, error } = await this.supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select(
        'id, organization_id, user_id, role, joined_at, profiles:user_id(full_name, email, title)'
      )
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`);
    }
    if (!data) return null;

    const parsed = OrgMemberRowSchema.safeParse(data);
    if (!parsed.success) return null;
    const row = parsed.data;

    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      name: row.profiles?.full_name || 'Kanzleimitglied',
      email: row.profiles?.email || 'mitarbeiter@kanzlei.de',
      title: row.profiles?.title || undefined,
    };
  }

  async inviteMember(data: InviteMemberRequest, organizationId: string): Promise<TeamMember> {
    const generatedUserId = crypto.randomUUID();
    const { data: inserted, error } = await this.supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: generatedUserId,
        role: data.role,
        joined_at: new Date().toISOString(),
      })
      .select('id, organization_id, user_id, role, joined_at')
      .single();

    if (error) {
      throw new Error(`Failed to invite member: ${error.message}`);
    }

    return {
      id: inserted.id,
      organizationId: inserted.organization_id,
      userId: inserted.user_id,
      role: inserted.role,
      joinedAt: inserted.joined_at,
      name: data.name,
      email: data.email,
      title: data.title,
    };
  }

  async removeMember(id: string, organizationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('organization_members')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }
    return true;
  }
}
