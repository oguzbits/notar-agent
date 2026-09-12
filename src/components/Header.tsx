import React from 'react';
import { BrandLogo } from '@/components/BrandLogo';

interface HeaderProps {
  caseNumber?: string;
  storageType?: 'supabase' | 'in-memory' | 'none' | 'local-only';
  overallStatus?: 'READY' | 'ACTION_REQUIRED' | 'BLOCKED';
  onLogoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Links: BrandLogo */}
        <div className="flex items-center gap-4">
          <BrandLogo onClick={onLogoClick} />
        </div>
      </div>
    </header>
  );
};
