import { Download } from 'lucide-react';
import React from 'react';
import { downloadJsonFile } from '@/lib/export/download-helper';
import { Dossier } from '@/types/dossier';

interface ExportActionsProps {
  dossier: Dossier;
}

export const ExportActions: React.FC<ExportActionsProps> = ({ dossier }) => {
  const downloadJson = () => {
    const fileName = `dossier_${dossier.caseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    downloadJsonFile(fileName, dossier);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={downloadJson}
        className="bg-notar-500 text-notar-950 hover:bg-notar-600 inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-base font-semibold shadow-xs transition-colors"
      >
        <Download className="h-4 w-4" />
        <span>JSON-Export</span>
      </button>
    </div>
  );
};
