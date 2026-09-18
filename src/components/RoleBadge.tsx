'use client';

import { ChevronDown, Building2, Settings, LogOut, ShieldCheck, Scale } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { ROLE_LABELS_DE, ROLE_AUTHORITY_DESCRIPTIONS_DE } from '@/lib/auth/role-labels';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';

interface RoleBadgeProps {
  onOpenTeamSettings?: () => void;
  onOpenOrganizationGateway?: () => void;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  onOpenTeamSettings,
  onOpenOrganizationGateway,
}) => {
  const { organization, hasActiveOrganization, currentUser, logout } = useAuth();
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

  const roleLabel = ROLE_LABELS_DE[currentUser.role] || currentUser.role;
  const authorityDescription = ROLE_AUTHORITY_DESCRIPTIONS_DE[currentUser.role];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Fachlicher Kanzleistatus-Trigger (TriNotar / NoRA Standard) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'border-border bg-card/90 hover:bg-muted/70 focus:ring-notar-900 flex cursor-pointer items-center gap-3 rounded-xl border py-1.5 pr-3.5 pl-2 shadow-xs transition-colors focus:ring-2 focus:outline-none',
          !hasActiveOrganization && 'border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Kanzleistatus & Amtsinhaber-Profil"
      >
        {/* Dienstsiegel / Initialen Emblem */}
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tracking-tight',
            hasActiveOrganization
              ? 'bg-notar-100 text-notar-900 border-notar-300 dark:bg-notar-950 dark:text-notar-100 dark:border-notar-800'
              : 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-100'
          )}
        >
          {initials}
        </div>

        {/* Notariat & Funktionsträger */}
        <div className="flex flex-col text-left leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-foreground text-base font-semibold tracking-tight">
              {currentUser.name}
            </span>
            {hasActiveOrganization && (
              <span className="bg-notar-100 text-notar-900 border-notar-300 dark:bg-notar-950 dark:text-notar-200 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold">
                {roleLabel}
              </span>
            )}
          </div>
          <span className="text-muted-foreground truncate text-sm">
            {hasActiveOrganization && organization
              ? `${organization.name} • ${organization.officialSeat}`
              : 'Keine Kanzleizuweisung'}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Fachliches Kanzlei- & Amtsinhaber-Menü */}
      {isOpen && (
        <div
          className="bg-card border-border animate-in fade-in-50 zoom-in-95 absolute right-0 z-50 mt-2 w-96 rounded-2xl border p-2.5 shadow-2xl backdrop-blur-md duration-150"
          role="menu"
        >
          {/* Sektion 1: Notariatsstelle / Kanzlei */}
          <div className="border-border border-b px-3 py-3">
            {hasActiveOrganization && organization ? (
              <div className="space-y-1.5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-4 w-4 shrink-0 opacity-70" />
                  <span>
                    {organization.officialSeat} • {organization.chamberDistrict}
                  </span>
                </div>
                <div className="text-foreground truncate text-lg font-bold tracking-tight">
                  {organization.name}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                  Keine Notarkanzlei zugewiesen
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Sie sind noch keiner Kanzlei zugeordnet. Richten Sie Ihr Notariat ein oder treten
                  Sie einer bestehenden Kanzlei bei.
                </p>
                {onOpenOrganizationGateway && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenOrganizationGateway();
                    }}
                    className="bg-notar-900 hover:bg-notar-800 mt-1 flex w-full cursor-pointer items-center justify-center rounded-lg py-2.5 text-base font-semibold text-white transition-colors"
                  >
                    Kanzlei einrichten oder beitreten
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sektion 2: Amtsinhaber / Funktion & Befugnisse */}
          <div className="bg-muted/40 border-border my-2 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Amtliche Funktion
                </div>
                <div className="text-foreground mt-0.5 text-base font-bold">{roleLabel}</div>
              </div>
              <Scale className="text-notar-900 dark:text-notar-300 h-5 w-5 shrink-0 opacity-80" />
            </div>
            {authorityDescription && (
              <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{authorityDescription}</span>
              </div>
            )}
            <div className="text-muted-foreground border-border/60 mt-1.5 truncate border-t pt-1.5 text-sm">
              {currentUser.email}
            </div>
          </div>

          {/* Sektion 3: Kanzleiverwaltung */}
          {hasActiveOrganization && onOpenTeamSettings && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenTeamSettings();
                }}
                className="text-foreground hover:bg-muted flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-base font-medium transition-colors"
              >
                <Settings className="text-muted-foreground h-4 w-4" />
                <span>Kanzlei-Einstellungen &amp; Team</span>
              </button>
            </div>
          )}

          {/* Sektion 4: Abmelden */}
          <div className="border-border border-t pt-1">
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
