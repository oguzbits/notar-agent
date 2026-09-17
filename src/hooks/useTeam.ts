'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TeamMember, InviteMemberRequest } from '@/types/auth';
import { NotaryRole } from '@/types/organization';

export const TEAM_QUERY_KEY = ['team-members'] as const;

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch('/api/team');
  if (!res.ok) {
    throw new Error('Kanzleiteam konnte nicht geladen werden.');
  }
  const data = await res.json();
  return (data.members || []) as TeamMember[];
}

async function apiUpdateMemberRole({
  memberId,
  role,
}: {
  memberId: string;
  role: NotaryRole;
}): Promise<TeamMember> {
  const res = await fetch(`/api/team/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error('Rolle konnte nicht geändert werden.');
  }
  const data = await res.json();
  return data.member as TeamMember;
}

async function apiInviteMember(request: InviteMemberRequest): Promise<TeamMember> {
  const res = await fetch('/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error('Mitarbeiter konnte nicht eingeladen werden.');
  }
  const data = await res.json();
  return data.member as TeamMember;
}

async function apiRemoveMember(memberId: string): Promise<boolean> {
  const res = await fetch(`/api/team/${memberId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Mitglied konnte nicht entfernt werden.');
  }
  return true;
}

export function useTeam() {
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: TEAM_QUERY_KEY,
    queryFn: fetchTeamMembers,
  });

  const updateRoleMutation = useMutation({
    mutationFn: apiUpdateMemberRole,
    onSuccess: (updated) => {
      queryClient.setQueryData<TeamMember[]>(TEAM_QUERY_KEY, (old = []) =>
        old.map((m) => (m.id === updated.id ? updated : m))
      );
    },
  });

  const inviteMutation = useMutation({
    mutationFn: apiInviteMember,
    onSuccess: (newMember) => {
      queryClient.setQueryData<TeamMember[]>(TEAM_QUERY_KEY, (old = []) => [...old, newMember]);
    },
  });

  const removeMutation = useMutation({
    mutationFn: apiRemoveMember,
    onSuccess: (_, memberId) => {
      queryClient.setQueryData<TeamMember[]>(TEAM_QUERY_KEY, (old = []) =>
        old.filter((m) => m.id !== memberId)
      );
    },
  });

  return {
    members,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
    updateMemberRole: (memberId: string, role: NotaryRole) =>
      updateRoleMutation.mutateAsync({ memberId, role }),
    inviteMember: (request: InviteMemberRequest) => inviteMutation.mutateAsync(request),
    removeMember: (memberId: string) => removeMutation.mutateAsync(memberId),
    isUpdating: updateRoleMutation.isPending,
    isInviting: inviteMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
