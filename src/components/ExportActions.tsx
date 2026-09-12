import React from 'react';
import { Dossier } from '@/types/dossier';
import { Download } from 'lucide-react';

interface ExportActionsProps {
  dossier: Dossier;
}

export const ExportActions: React.FC<ExportActionsProps> = ({ dossier }) => {
  const downloadJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dossier, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `dossier_${dossier.caseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={downloadJson}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#A2E771] px-3.5 py-2 text-base font-semibold text-[#284E0D] shadow-xs transition-colors hover:bg-[#83DF41]"
      >
        <Download className="h-4 w-4" />
        <span>JSON-Export</span>
      </button>
    </div>
  );
};
