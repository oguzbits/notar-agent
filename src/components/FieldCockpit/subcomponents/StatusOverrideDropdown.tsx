import { ChevronDown } from 'lucide-react';
import React from 'react';
import { FieldStatus } from '@/types/dossier';

interface StatusOverrideDropdownProps {
  status: FieldStatus;
  onChange: (newStatus: FieldStatus) => void;
}

export const StatusOverrideDropdown: React.FC<StatusOverrideDropdownProps> = ({
  status,
  onChange,
}) => {
  return (
    <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as FieldStatus)}
        className={`cursor-pointer appearance-none rounded-md border py-1.5 pr-6 pl-2.5 text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
          status === 'VERIFIED'
            ? 'border-notar-400 bg-notar-200 text-notar-950 focus:ring-notar-900'
            : status === 'NEEDS_REVIEW'
              ? 'border-amber-300 bg-amber-50 text-amber-950 focus:ring-amber-500'
              : status === 'OUTDATED'
                ? 'border-orange-300 bg-orange-50 text-orange-950 focus:ring-orange-500'
                : 'border-slate-200 bg-slate-100 text-slate-700 focus:ring-slate-400'
        }`}
        title="Status dieses Feldes ändern"
      >
        <option value="VERIFIED">Belegt</option>
        <option value="NEEDS_REVIEW">Prüfung nötig</option>
        <option value="OUTDATED">Veraltet</option>
        <option value="MISSING">Fehlt</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 opacity-60" />
    </div>
  );
};
