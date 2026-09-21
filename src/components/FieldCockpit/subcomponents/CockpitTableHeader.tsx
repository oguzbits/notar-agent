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
    <thead className="text-muted-foreground border-border bg-muted/40 border-b text-sm font-semibold">
      <tr>
        <th className="w-10 min-w-10 px-2 py-3 text-center">#</th>
        <th className="w-36 min-w-36 px-3 py-3 leading-tight">Pflichtfeld</th>
        <th className="w-40 min-w-40 px-4 py-3 whitespace-nowrap">Status</th>
        <th className="min-w-72 px-4 py-3">Befund &amp; Prüfungshinweis</th>
        <th className="w-44 px-3 py-3">Quelle / Nachweis</th>
        <th className="w-10 min-w-10 px-2 py-3 text-center">
          <button
            type="button"
            onClick={onToggleAll}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-notar-900 inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors focus-visible:ring-2"
            title={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
            aria-label={isAllExpanded ? 'Alle Details einklappen' : 'Alle Details aufklappen'}
            aria-expanded={isAllExpanded}
          >
            {isAllExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </th>
      </tr>
    </thead>
  );
};
