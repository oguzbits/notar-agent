'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { UserPlus, Mail, X, UserX } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { NOTARY_ROLES, NotaryRole, ROLE_LABELS_DE } from '@/types/organization';

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
    hasRolePermission,
  } = useAuth();

  const canManage = hasRolePermission(PERMISSION_ACTIONS.MANAGE_TEAM);

  const [isInviting, setIsInviting] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<NotaryRole>(NOTARY_ROLES.SACHBEARBEITER);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
                  Kanzlei-Team &amp; Rollen
                </Dialog.Title>
                <Dialog.Description
                  id="team-settings-description"
                  className="text-muted-foreground mt-1 text-base"
                >
                  {organization.name} • {organization.officialSeat}
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

            {/* Invite Form or Invite Trigger */}
            {canManage && !isInviting && (
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

            {canManage && isInviting && (
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Vollständiger Name"
                    className="border-input bg-background text-foreground focus:ring-notar-900 w-full rounded-lg border px-3 py-2 text-base focus:ring-2 focus:outline-none"
                  />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-Mail-Adresse"
                    className="border-input bg-background text-foreground focus:ring-notar-900 w-full rounded-lg border px-3 py-2 text-base focus:ring-2 focus:outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as NotaryRole)}
                    className="border-input bg-background text-foreground focus:ring-notar-900 w-full cursor-pointer rounded-lg border px-3 py-2 text-base focus:ring-2 focus:outline-none"
                  >
                    {(Object.keys(NOTARY_ROLES) as NotaryRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS_DE[r]}
                      </option>
                    ))}
                  </select>
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
                        {canManage && !isSelf ? (
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

                        {canManage && !isSelf && (
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

            {/* Footer */}
            <div className="border-border flex justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Fertig
              </Button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
