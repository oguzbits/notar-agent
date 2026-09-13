import { ChevronDown, Loader2 } from 'lucide-react';
import React from 'react';
import { STATUS_LABELS_DE } from '@/lib/dossier/constants';
import { cn } from '@/lib/utils';
import { FieldStatus, FIELD_STATUS } from '@/types/dossier';

interface StatusOverrideDropdownProps {
  status: FieldStatus;
  onChange: (newStatus: FieldStatus) => void;
  isUpdating?: boolean;
}

export const StatusOverrideDropdown: React.FC<StatusOverrideDropdownProps> = ({
  status,
  onChange,
  isUpdating = false,
}) => {
  return (
    <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <select
        value={status}
        disabled={isUpdating}
        onChange={(e) => onChange(e.target.value as FieldStatus)}
        className={cn(
          'cursor-pointer appearance-none rounded-md border py-1.5 pr-7 pl-3 text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none',
          status === FIELD_STATUS.VERIFIED &&
            'border-notar-400 bg-notar-200 text-notar-950 focus:ring-notar-900',
          status === FIELD_STATUS.NEEDS_REVIEW &&
            'border-amber-300 bg-amber-50 text-amber-950 focus:ring-amber-500',
          status === FIELD_STATUS.OUTDATED &&
            'border-orange-300 bg-orange-50 text-orange-950 focus:ring-orange-500',
          status === FIELD_STATUS.MISSING &&
            'border-slate-200 bg-slate-100 text-slate-700 focus:ring-slate-400',
          isUpdating && 'cursor-wait opacity-60'
        )}
        title={isUpdating ? 'Wird im Kanzleidossier gespeichert...' : 'Status dieses Feldes ändern'}
      >
        <option value={FIELD_STATUS.VERIFIED}>{STATUS_LABELS_DE[FIELD_STATUS.VERIFIED]}</option>
        <option value={FIELD_STATUS.NEEDS_REVIEW}>
          {STATUS_LABELS_DE[FIELD_STATUS.NEEDS_REVIEW]}
        </option>
        <option value={FIELD_STATUS.OUTDATED}>{STATUS_LABELS_DE[FIELD_STATUS.OUTDATED]}</option>
        <option value={FIELD_STATUS.MISSING}>{STATUS_LABELS_DE[FIELD_STATUS.MISSING]}</option>
      </select>
      {isUpdating ? (
        <Loader2 className="pointer-events-none absolute right-2 h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 opacity-60" />
      )}
    </div>
  );
};
