import { CheckCircle2, AlertTriangle, Clock, HelpCircle, type LucideIcon } from 'lucide-react';
import React from 'react';
import { CaseStatus } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { FieldStatus } from '@/types/dossier';

export type StatusVariant = FieldStatus | CaseStatus | 'Beurkundet';

interface BadgeConfig {
  label: string;
  className: string;
  icon: LucideIcon;
  iconClass: string;
}

const statusBadgeConfig: Record<string, BadgeConfig> = {
  VERIFIED: {
    label: 'Belegt',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
  },
  Entwurfsreif: {
    label: 'Entwurfsreif',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
  },
  Beurkundet: {
    label: 'Entwurfsreif',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
  },
  NEEDS_REVIEW: {
    label: 'Prüfung nötig',
    className: 'border-amber-300 bg-amber-50 text-amber-950 font-semibold',
    icon: AlertTriangle,
    iconClass: 'text-amber-700',
  },
  OUTDATED: {
    label: 'Veraltet',
    className: 'border-orange-300 bg-orange-50 text-orange-950 font-semibold',
    icon: Clock,
    iconClass: 'text-orange-700',
  },
  'In Prüfung': {
    label: 'In Prüfung',
    className: 'border-amber-300/80 bg-amber-50 text-amber-900 font-semibold',
    icon: Clock,
    iconClass: 'text-amber-600',
  },
  MISSING: {
    label: 'Fehlt',
    className: 'border-slate-200 bg-slate-100/80 text-slate-600 font-medium',
    icon: HelpCircle,
    iconClass: 'text-slate-500',
  },
};

const defaultBadgeConfig: BadgeConfig = statusBadgeConfig.MISSING ?? {
  label: 'Fehlt',
  className: 'border-slate-200 bg-slate-100/80 text-slate-600 font-medium',
  icon: HelpCircle,
  iconClass: 'text-slate-500',
};

export const statusBadgeSizes = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm font-medium px-2.5 py-1',
} as const;

export type StatusBadgeSize = keyof typeof statusBadgeSizes;

interface StatusBadgeProps {
  status: StatusVariant;
  size?: StatusBadgeSize;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className }) => {
  const config = statusBadgeConfig[status] || defaultBadgeConfig;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border whitespace-nowrap',
        statusBadgeSizes[size],
        config.className,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.iconClass)} />
      {config.label}
    </span>
  );
};
