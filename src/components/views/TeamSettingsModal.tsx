'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { UserPlus, Mail, X, UserX, Building2, Users, Check, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { ROLE_LABELS_DE } from '@/lib/auth/role-labels';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { NOTARY_ROLES, NotaryRole } from '@/types/organization';

interface TeamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamSettingsModal: React.FC<TeamSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    organization,
    currentUser,
    teamMembers,
    updateMemberRole,
    removeMember,
    inviteMember,
    updateOrganization,
    hasRolePermission,
  } = useAuth();

  const canManageTeam = hasRolePermission(PERMISSION_ACTIONS.MANAGE_TEAM);
  const canEditOrg =
    currentUser.role === NOTARY_ROLES.NOTAR || currentUser.role === NOTARY_ROLES.ADMIN;

  const [activeTab, setActiveTab] = useState<'stammdaten' | 'team'>('stammdaten');

  // Stammdaten State
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [officialSeat, setOfficialSeat] = useState(organization?.officialSeat || '');
  const [chamberDistrict, setChamberDistrict] = useState(organization?.chamberDistrict || '');
  const [prevOrg, setPrevOrg] = useState(organization);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [orgSaveSuccess, setOrgSaveSuccess] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // Sync state if organization changes (React 19 pattern: adjusting state during render)
  if (organization !== prevOrg) {
    setPrevOrg(organization);
    setOrgName(organization?.name || '');
    setOfficialSeat(organization?.officialSeat || '');
    setChamberDistrict(organization?.chamberDistrict || '');
  }

  // Team Invite State
  const [isInviting, setIsInviting] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<NotaryRole>(NOTARY_ROLES.SACHBEARBEITER);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError(null);
    setOrgSaveSuccess(false);

    const trimmedName = orgName.trim();
    const trimmedSeat = officialSeat.trim();
    const trimmedDistrict = chamberDistrict.trim();

    if (!trimmedName || !trimmedSeat || !trimmedDistrict) {
      setOrgError('Bitte füllen Sie alle Kanzlei-Pflichtangaben aus.');
      return;
    }

    try {
      setIsSavingOrg(true);
      await updateOrganization({
        name: trimmedName,
        officialSeat: trimmedSeat,
        chamberDistrict: trimmedDistrict,
      });
      setOrgSaveSuccess(true);
      setTimeout(() => setOrgSaveSuccess(false), 3000);
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : 'Fehler beim Speichern der Kanzleidaten.');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setInviteError('Bitte geben Sie Name und E-Mail-Adresse an.');
      return;
    }

    if (teamMembers.some((m) => m.email.toLowerCase() === trimmedEmail)) {
      setInviteError('Ein Mitglied mit dieser E-Mail-Adresse existiert bereits.');
      return;
    }

    try {
      await inviteMember(trimmedName, trimmedEmail, inviteRole);
      setInviteName('');
      setInviteEmail('');
      setInviteRole(NOTARY_ROLES.SACHBEARBEITER);
      setIsInviting(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Fehler beim Einladen.');
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-xs duration-150" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            aria-describedby="team-settings-description"
            className="border-border bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 w-full max-w-2xl space-y-6 rounded-2xl border p-6 shadow-2xl duration-150 focus:outline-hidden sm:p-8"
          >
            {/* Header: Title & Close Button */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <Dialog.Title className="text-foreground text-xl font-bold tracking-tight">
                  Kanzlei-Einstellungen
                </Dialog.Title>
                <Dialog.Description
                  id="team-settings-description"
                  className="text-muted-foreground mt-1 text-base"
                >
                  {organization
                    ? `${organization.name} • ${organization.officialSeat}`
                    : 'Keine Kanzlei zugewiesen'}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-2 transition-colors"
                  aria-label="Schließen"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Tab Navigation (GitHub / Supabase Settings Style) */}
            <div className="border-border flex border-b">
              <button
                type="button"
                onClick={() => setActiveTab('stammdaten')}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-base font-medium transition-colors',
                  activeTab === 'stammdaten'
                    ? 'border-notar-900 text-foreground dark:border-notar-400 font-semibold'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                <Building2 className="h-4 w-4" />
                Kanzlei-Stammdaten
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-base font-medium transition-colors',
                  activeTab === 'team'
                    ? 'border-notar-900 text-foreground dark:border-notar-400 font-semibold'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                <Users className="h-4 w-4" />
                Team &amp; Rollen ({teamMembers.length})
              </button>
            </div>

            {/* TAB 1: Kanzlei-Stammdaten */}
            {activeTab === 'stammdaten' && (
              <div className="space-y-5">
                {orgError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{orgError}</span>
                  </div>
                )}
                {orgSaveSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Kanzlei-Stammdaten wurden erfolgreich aktualisiert.</span>
                  </div>
                )}

                <form onSubmit={handleOrgSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="edit-org-name"
                      className="text-foreground mb-1.5 block text-base font-medium"
                    >
                      Kanzleiname / Notariat
                    </label>
                    <Input
                      id="edit-org-name"
                      type="text"
                      required
                      disabled={!canEditOrg || isSavingOrg}
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="z. B. Notariat Dr. Muster & Partner"
                      containerClassName="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="edit-official-seat"
                        className="text-foreground mb-1.5 block text-base font-medium"
                      >
                        Amtssitz (Stadt / Ort)
                      </label>
                      <Input
                        id="edit-official-seat"
                        type="text"
                        required
                        disabled={!canEditOrg || isSavingOrg}
                        value={officialSeat}
                        onChange={(e) => setOfficialSeat(e.target.value)}
                        placeholder="z. B. Münster"
                        containerClassName="w-full"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-chamber-district"
                        className="text-foreground mb-1.5 block text-base font-medium"
                      >
                        Notarkammerbezirk
                      </label>
                      <Input
                        id="edit-chamber-district"
                        type="text"
                        required
                        disabled={!canEditOrg || isSavingOrg}
                        value={chamberDistrict}
                        onChange={(e) => setChamberDistrict(e.target.value)}
                        placeholder="z. B. Westfälische Notarkammer"
                        containerClassName="w-full"
                      />
                    </div>
                  </div>

                  {!canEditOrg && (
                    <p className="text-muted-foreground text-sm">
                      Hinweis: Nur Notare oder Administratoren können die Kanzlei-Stammdaten ändern.
                    </p>
                  )}

                  {canEditOrg && (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={isSavingOrg}
                        leftIcon={orgSaveSuccess ? <Check className="h-4 w-4" /> : undefined}
                      >
                        {isSavingOrg ? 'Wird gespeichert...' : 'Änderungen speichern'}
                      </Button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* TAB 2: Team & Rollen */}
            {activeTab === 'team' && (
              <div className="space-y-4">
                {/* Invite Form or Invite Trigger */}
                {canManageTeam && !isInviting && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsInviting(true)}
                      leftIcon={<UserPlus className="h-4 w-4" />}
                    >
                      Mitarbeiter einladen
                    </Button>
                  </div>
                )}

                {canManageTeam && isInviting && (
                  <form
                    onSubmit={handleInviteSubmit}
                    className="bg-muted/40 border-border space-y-4 rounded-xl border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-base font-semibold">
                        Neuen Mitarbeiter einladen
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsInviting(false);
                          setInviteError(null);
                        }}
                        className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium"
                      >
                        Abbrechen
                      </button>
                    </div>

                    {inviteError && (
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {inviteError}
                      </p>
                    )}

                    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
                      <Input
                        type="text"
                        required
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Vollständiger Name"
                        containerClassName="w-full"
                      />
                      <Input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="E-Mail-Adresse"
                        containerClassName="w-full"
                      />
                      <div className="w-full">
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as NotaryRole)}
                          className="border-input bg-background text-foreground focus:ring-notar-900 block min-h-11 w-full cursor-pointer rounded-lg border px-3 py-2.5 text-base focus:border-transparent focus:ring-2 focus:outline-none"
                        >
                          {(Object.keys(NOTARY_ROLES) as NotaryRole[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS_DE[r]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsInviting(false);
                          setInviteError(null);
                        }}
                      >
                        Abbrechen
                      </Button>
                      <Button type="submit" variant="primary" size="sm">
                        Einladung senden
                      </Button>
                    </div>
                  </form>
                )}

                {/* Member List (Clerk / Linear Minimalist Clean Style) */}
                <div className="divide-border/60 max-h-96 divide-y overflow-y-auto pr-1">
                  {teamMembers.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center text-base">
                      Noch keine Kanzleimitglieder vorhanden. Klicken Sie oben auf „Mitarbeiter
                      einladen“.
                    </div>
                  ) : (
                    teamMembers.map((member) => {
                      const isSelf = member.id === currentUser.id;
                      const initials = member.name
                        .split(' ')
                        .map((p) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                        >
                          {/* User Identity */}
                          <div className="flex min-w-0 items-center gap-3.5">
                            <div className="bg-notar-100 text-notar-900 border-notar-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-foreground truncate text-base font-semibold">
                                  {member.name}
                                </span>
                                {isSelf && (
                                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs font-semibold">
                                    Sie
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground flex items-center gap-1.5 truncate text-sm">
                                <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                <span className="truncate">{member.email}</span>
                              </div>
                            </div>
                          </div>

                          {/* Role & Actions */}
                          <div className="flex shrink-0 items-center gap-3">
                            {canManageTeam && !isSelf ? (
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  updateMemberRole(member.id, e.target.value as NotaryRole)
                                }
                                className="border-input bg-background text-foreground focus:ring-notar-900 cursor-pointer rounded-lg border px-3 py-1.5 text-base font-medium focus:ring-2 focus:outline-none"
                              >
                                {(Object.keys(NOTARY_ROLES) as NotaryRole[]).map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS_DE[r]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-muted-foreground px-2 py-1 text-base font-medium">
                                {ROLE_LABELS_DE[member.role]}
                              </span>
                            )}

                            {canManageTeam && !isSelf && (
                              <button
                                type="button"
                                onClick={() => removeMember(member.id)}
                                className="text-muted-foreground cursor-pointer rounded-lg p-2 transition-colors hover:text-red-600"
                                title={`${member.name} entfernen`}
                                aria-label={`${member.name} entfernen`}
                              >
                                <UserX className="h-4.5 w-4.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
