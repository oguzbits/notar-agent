import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  HelpCircle,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';
import { CASE_STATUS, CaseStatus } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { FIELD_STATUS, FieldStatus } from '@/types/dossier';
import { JOB_STATUS, JobStatus } from '@/types/jobs';

export const SPECIAL_CASE_STATUS = {
  BEURKUNDET: 'Beurkundet',
} as const;

export type SpecialCaseStatus = (typeof SPECIAL_CASE_STATUS)[keyof typeof SPECIAL_CASE_STATUS];

export type StatusVariant = FieldStatus | CaseStatus | SpecialCaseStatus | JobStatus;

interface BadgeConfig {
  label: string;
  className: string;
  icon: LucideIcon;
  iconClass: string;
}

const statusBadgeConfig: Record<string, BadgeConfig> = {
  [FIELD_STATUS.VERIFIED]: {
    label: 'Belegt',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
  },
  [CASE_STATUS.DRAFT_READY]: {
    label: 'Entwurfsreif',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
  },
  [SPECIAL_CASE_STATUS.BEURKUNDET]: {
    label: 'Entwurfsreif',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
  },
  [FIELD_STATUS.NEEDS_REVIEW]: {
    label: 'Prüfung nötig',
    className: 'border-amber-300 bg-amber-50 text-amber-950 font-semibold',
    icon: AlertTriangle,
    iconClass: 'text-amber-700',
  },
  [FIELD_STATUS.OUTDATED]: {
    label: 'Veraltet',
    className: 'border-orange-300 bg-orange-50 text-orange-950 font-semibold',
    icon: Clock,
    iconClass: 'text-orange-700',
  },
  [CASE_STATUS.IN_PROGRESS]: {
    label: 'In Prüfung',
    className: 'border-amber-300/80 bg-amber-50 text-amber-900 font-semibold',
    icon: Clock,
    iconClass: 'text-amber-600',
  },
  [FIELD_STATUS.MISSING]: {
    label: 'Fehlt',
    className: 'border-slate-200 bg-slate-100/80 text-slate-600 font-medium',
    icon: HelpCircle,
    iconClass: 'text-slate-500',
  },
  [JOB_STATUS.PENDING]: {
    label: 'In Warteschlange',
    className: 'border-sky-300 bg-sky-50 text-sky-950 font-semibold',
    icon: Clock,
    iconClass: 'text-sky-700',
  },
  [JOB_STATUS.PROCESSING]: {
    label: 'Wird analysiert...',
    className: 'border-notar-500/50 bg-notar-100 text-notar-950 font-semibold',
    icon: Loader2,
    iconClass: 'text-notar-900 animate-spin',
  },
  [JOB_STATUS.FAILED]: {
    label: 'Fehlgeschlagen',
    className: 'border-destructive/30 bg-destructive/10 text-destructive font-semibold',
    icon: AlertTriangle,
    iconClass: 'text-destructive',
  },
  [JOB_STATUS.COMPLETED]: {
    label: 'Abgeschlossen',
    className: 'border-notar-400 bg-notar-200 text-notar-950 font-semibold',
    icon: CheckCircle2,
    iconClass: 'text-notar-900',
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
