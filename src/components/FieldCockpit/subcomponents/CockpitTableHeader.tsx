import { ChevronDown, ChevronUp } from 'lucide-react';
import React from 'react';

interface CockpitTableHeaderProps {
  isAllExpanded: boolean;
  onToggleAll: () => void;
}

export const CockpitTableHeader: React.FC<CockpitTableHeaderProps> = ({
  isAllExpanded,
  onToggleAll,
}) => {
  return (
    <thead className="text-muted-foreground border-border border-b bg-slate-50/80 text-sm font-semibold dark:bg-slate-900/50">
      <tr>
        <th className="w-[40px] min-w-[40px] px-2 py-3 text-center">#</th>
        <th className="w-[145px] min-w-[145px] px-3 py-3 leading-tight">Pflichtfeld</th>
        <th className="w-[160px] min-w-[160px] px-4 py-3 whitespace-nowrap">Status</th>
        <th className="min-w-[280px] px-4 py-3">Befund &amp; Prüfungshinweis</th>
        <th className="w-[170px] px-3 py-3">Quelle / Nachweis</th>
        <th className="w-[40px] min-w-[40px] px-2 py-3 text-center">
          <button
            type="button"
            onClick={onToggleAll}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-notar-900 inline-flex cursor-pointer items-center justify-center rounded p-1 transition-colors focus-visible:ring-2"
            title={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
            aria-label={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
            aria-expanded={isAllExpanded}
          >
            {isAllExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </th>
      </tr>
    </thead>
  );
};
