import { CheckCircle2, AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import React from 'react';
import { FieldStatus } from '@/types/dossier';

export type StatusVariant = FieldStatus | 'Entwurfsreif' | 'In Prüfung' | 'Beurkundet';

interface StatusBadgeProps {
  status: StatusVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm
    ? 'text-xs px-2 py-1 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5'
    : 'text-sm font-medium px-2.5 py-1 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5';

  switch (status) {
    case 'VERIFIED':
    case 'Entwurfsreif':
    case 'Beurkundet':
      return (
        <span
          className={`border-notar-400 bg-notar-200 text-notar-950 inline-flex items-center gap-1.5 rounded-md border font-semibold ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="text-notar-900 h-3.5 w-3.5 shrink-0" />
          {status === 'VERIFIED' ? 'Belegt' : 'Entwurfsreif'}
        </span>
      );
    case 'NEEDS_REVIEW':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 font-semibold text-amber-950 ${sizeClasses} ${className}`}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
          Prüfung nötig
        </span>
      );
    case 'OUTDATED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 font-semibold text-orange-950 ${sizeClasses} ${className}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-orange-700" />
          Veraltet
        </span>
      );
    case 'In Prüfung':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-amber-300/80 bg-amber-50 font-semibold text-amber-900 ${sizeClasses} ${className}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          In Prüfung
        </span>
      );
    case 'MISSING':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100/80 font-medium text-slate-600 ${sizeClasses} ${className}`}
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          Fehlt
        </span>
      );
  }
};
