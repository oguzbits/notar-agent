import React from 'react';
import Link from 'next/link';

interface BrandLogoProps {
  className?: string;
  href?: string;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', href = '/', onClick }) => {
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#A2E771] text-base font-bold text-[#284E0D] shadow-xs">
        N
      </div>
      <span className="text-foreground text-base font-bold tracking-tight">NotarPartner</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group focus-visible:ring-ring flex cursor-pointer items-center gap-2.5 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={`group focus-visible:ring-ring flex items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none ${className}`}
    >
      {content}
    </Link>
  );
};
