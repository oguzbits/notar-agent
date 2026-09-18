'use client';

import React, { useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { RoleBadge } from '@/components/RoleBadge';
import { TeamSettingsModal } from '@/components/views/TeamSettingsModal';
import { OverallStatus, StorageType } from '@/types/dossier';

interface HeaderProps {
  caseNumber?: string;
  storageType?: StorageType;
  overallStatus?: OverallStatus;
  onLogoClick?: () => void;
  onOpenTeamSettings?: () => void;
  onOpenOrganizationGateway?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onLogoClick,
  onOpenTeamSettings,
  onOpenOrganizationGateway,
}) => {
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  const handleOpenTeam = () => {
    if (onOpenTeamSettings) {
      onOpenTeamSettings();
    } else {
      setIsTeamModalOpen(true);
    }
  };

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Links: BrandLogo */}
        <div className="flex items-center gap-4">
          <BrandLogo onClick={onLogoClick} />
        </div>

        {/* Rechts: Kanzlei & Rollen-Badge */}
        <div className="flex items-center gap-3">
          <RoleBadge
            onOpenTeamSettings={handleOpenTeam}
            onOpenOrganizationGateway={onOpenOrganizationGateway}
          />
        </div>
      </div>

      {/* Team Settings Dialog Modal (Clerk/Linear Standard) */}
      <TeamSettingsModal isOpen={isTeamModalOpen} onClose={() => setIsTeamModalOpen(false)} />
    </header>
  );
};
