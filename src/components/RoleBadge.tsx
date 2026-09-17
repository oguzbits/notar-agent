'use client';

import { ChevronDown, Building2, Users, Check, LogOut } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { NOTARY_ROLES, NotaryRole, ROLE_LABELS_DE } from '@/types/organization';

interface RoleBadgeProps {
  onOpenTeamSettings?: () => void;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ onOpenTeamSettings }) => {
  const { organization, currentUser, teamMembers, switchRole, switchUser, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Schließen bei Klick außerhalb
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Clean, minimalist Clerk / Linear style user trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="border-border bg-card/80 hover:bg-muted/60 focus:ring-notar-900 flex cursor-pointer items-center gap-2.5 rounded-full border py-1.5 pr-3 pl-1.5 text-base font-medium shadow-2xs transition-colors focus:ring-2 focus:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Konto &amp; Kanzlei-Einstellungen"
      >
        <div className="bg-notar-100 text-notar-900 border-notar-300 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold">
          {initials}
        </div>
        <div className="flex hidden flex-col text-left leading-tight sm:flex">
          <span className="text-foreground text-sm font-semibold">{currentUser.name}</span>
          <span className="text-muted-foreground text-xs">{ROLE_LABELS_DE[currentUser.role]}</span>
        </div>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="bg-card border-border animate-in fade-in-50 zoom-in-95 absolute right-0 z-50 mt-2 w-80 rounded-2xl border p-2 shadow-xl backdrop-blur-md duration-150"
          role="menu"
        >
          {/* Organization & User Info */}
          <div className="border-border border-b px-3 py-2.5">
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <Building2 className="h-3.5 w-3.5" />
              <span>{organization.officialSeat}</span>
            </div>
            <div className="text-foreground mt-0.5 truncate text-base font-semibold">
              {organization.name}
            </div>
            <div className="text-muted-foreground mt-0.5 truncate text-xs">{currentUser.email}</div>
          </div>

          {/* Team Settings Link */}
          {onOpenTeamSettings && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenTeamSettings();
                }}
                className="text-foreground hover:bg-muted flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-medium transition-colors"
              >
                <Users className="text-muted-foreground h-4 w-4" />
                <span>Kanzlei-Team verwalten</span>
              </button>
            </div>
          )}

          {/* Switch User (Kanzlei-Mitarbeiter wechseln) */}
          <div className="border-border border-t py-1">
            <div className="text-muted-foreground px-3 py-1.5 text-xs font-semibold tracking-wider uppercase">
              Benutzer wechseln
            </div>
            <div className="space-y-0.5">
              {teamMembers.map((member) => {
                const isSelected = member.id === currentUser.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      switchUser(member.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-muted text-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    role="menuitem"
                  >
                    <div className="truncate pr-2">
                      <div className="text-foreground truncate text-base">{member.name}</div>
                      <div className="text-muted-foreground text-sm">
                        {ROLE_LABELS_DE[member.role]}
                      </div>
                    </div>
                    {isSelected && <Check className="text-notar-900 h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role quick simulation */}
          <div className="border-border border-t py-1">
            <div className="text-muted-foreground px-3 py-1.5 text-xs font-semibold tracking-wider uppercase">
              Rolle testen
            </div>
            <div className="space-y-0.5">
              {(Object.keys(NOTARY_ROLES) as NotaryRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    switchRole(role);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-left text-base transition-colors',
                    currentUser.role === role
                      ? 'bg-notar-100 text-notar-950 dark:bg-notar-900/50 dark:text-notar-100 font-semibold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span>{ROLE_LABELS_DE[role]}</span>
                  {currentUser.role === role && (
                    <Check className="text-notar-900 h-4 w-4 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Abmelden (Logout) Button */}
          <div className="border-border border-t py-1">
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                await logout();
              }}
              className="text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-base font-medium transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
