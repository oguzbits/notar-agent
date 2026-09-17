'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTeam } from '@/hooks/useTeam';
import { hasPermission } from '@/lib/auth/rbac';
import { KanzleiUserProfile, PermissionAction, AuthSessionResponse } from '@/types/auth';
import { Organization, NotaryRole, NOTARY_ROLES } from '@/types/organization';

export interface KanzleiMemberItem extends KanzleiUserProfile {
  joinedAt: string;
}

interface AuthContextType {
  organization: Organization;
  currentUser: KanzleiUserProfile;
  teamMembers: KanzleiMemberItem[];
  isAuthenticated: boolean;
  switchRole: (newRole: NotaryRole) => void;
  switchUser: (userId: string) => void;
  logout: () => Promise<void>;
  updateMemberRole: (userId: string, newRole: NotaryRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  inviteMember: (name: string, email: string, role: NotaryRole) => Promise<void>;
  hasRolePermission: (action: PermissionAction) => boolean;
  isLoadingTeam: boolean;
  isLoadingSession: boolean;
}

// Kanonische Standard-Kanzlei gem. C.2
const DEFAULT_ORGANIZATION: Organization = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Notariat Standard Kanzlei',
  officialSeat: 'Münster',
  chamberDistrict: 'Westfälische Notarkammer',
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

const FALLBACK_DEFAULT_USER: KanzleiUserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Kanzleimitglied',
  email: 'notar@kanzlei.de',
  role: NOTARY_ROLES.NOTAR,
};

export const AUTH_SESSION_QUERY_KEY = ['auth-session'] as const;

const AUTH_STORAGE_KEY_USER_ID = 'notar_active_user_id';

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchAuthSession(): Promise<AuthSessionResponse | null> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error('Sitzungsdaten konnten nicht geladen werden.');
  }
  return (await res.json()) as AuthSessionResponse;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    members,
    isLoading: isLoadingTeam,
    updateMemberRole: apiUpdateRole,
    removeMember: apiRemove,
    inviteMember: apiInvite,
  } = useTeam();

  // Reale Supabase SSR Session laden
  const { data: sessionData, isLoading: isLoadingSession } = useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchAuthSession,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(AUTH_STORAGE_KEY_USER_ID) || '';
      } catch (err) {
        console.warn('Fehler beim Laden der Benutzer-ID aus localStorage:', err);
      }
    }
    return '';
  });

  const [simulatedRole, setSimulatedRole] = useState<NotaryRole | null>(null);

  useEffect(() => {
    if (currentUserId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY_USER_ID, currentUserId);
      } catch (err) {
        console.warn('Fehler beim Persistieren der Benutzer-ID in localStorage:', err);
      }
    }
  }, [currentUserId]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('Fehler beim Abmelden');
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, null);
      router.push('/login');
      router.refresh();
    },
  });

  const teamMembers: KanzleiMemberItem[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    title: m.title,
    joinedAt: m.joinedAt,
  }));

  // Falls authentifizierte Session vorliegt, nutze diese bevorzugt
  const sessionUser: KanzleiUserProfile | null = sessionData?.user || null;
  const activeMember =
    teamMembers.find((m) => m.id === currentUserId) ||
    (sessionUser ? { ...sessionUser, joinedAt: new Date().toISOString() } : teamMembers[0]);

  const currentUser: KanzleiUserProfile = activeMember
    ? {
        ...activeMember,
        role: simulatedRole || activeMember.role,
      }
    : FALLBACK_DEFAULT_USER;

  const currentOrg: Organization = sessionData?.organization
    ? {
        id: sessionData.organization.id,
        name: sessionData.organization.name,
        officialSeat: sessionData.organization.officialSeat,
        chamberDistrict: sessionData.organization.chamberDistrict,
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
      }
    : DEFAULT_ORGANIZATION;

  const switchRole = (newRole: NotaryRole) => {
    setSimulatedRole(newRole);
  };

  const switchUser = (userId: string) => {
    if (teamMembers.some((m) => m.id === userId)) {
      setCurrentUserId(userId);
      setSimulatedRole(null);
    }
  };

  const updateMemberRole = async (userId: string, newRole: NotaryRole) => {
    await apiUpdateRole(userId, newRole);
  };

  const removeMember = async (userId: string) => {
    if (userId === currentUser.id) return;
    await apiRemove(userId);
  };

  const inviteMember = async (name: string, email: string, role: NotaryRole) => {
    await apiInvite({ name, email, role });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const hasRolePermission = (action: PermissionAction): boolean => {
    return hasPermission(currentUser.role, action);
  };

  return (
    <AuthContext.Provider
      value={{
        organization: currentOrg,
        currentUser,
        teamMembers,
        isAuthenticated: !!sessionData?.user,
        switchRole,
        switchUser,
        logout,
        updateMemberRole,
        removeMember,
        inviteMember,
        hasRolePermission,
        isLoadingTeam,
        isLoadingSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb eines AuthProviders verwendet werden.');
  }
  return context;
}
