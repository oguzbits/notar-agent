import { Download, FileCheck2, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { downloadJsonFile, downloadTextFile, generatePruefberichtText } from '@/lib/export';
import { Dossier } from '@/types/dossier';

interface ExportActionsProps {
  dossier: Dossier;
  documentId?: string;
}

export const ExportActions: React.FC<ExportActionsProps> = ({ dossier, documentId }) => {
  const [isExportingReport, setIsExportingReport] = useState(false);

  const downloadJson = () => {
    const fileName = `dossier_${dossier.caseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    downloadJsonFile(fileName, dossier);
  };

  const downloadPruefbericht = async () => {
    setIsExportingReport(true);
    try {
      let auditOptions: Parameters<typeof generatePruefberichtText>[1] = undefined;

      if (documentId) {
        try {
          const res = await fetch(`/api/documents/${documentId}/audit`);
          if (res.ok) {
            const data = await res.json();
            auditOptions = {
              history: data.history,
              integrityValid: data.integrity?.valid,
            };
          }
        } catch (err) {
          console.warn('Audit-Trail konnte nicht für den Export geladen werden:', err);
        }
      }

      const reportText = generatePruefberichtText(dossier, auditOptions);
      const safeTitle = (dossier.caseTitle || 'vorgang').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `pruefbericht_${safeTitle}.txt`;
      downloadTextFile(fileName, reportText);
    } finally {
      setIsExportingReport(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        disabled={isExportingReport}
        onClick={downloadPruefbericht}
        className="border-border bg-background hover:bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-base font-semibold shadow-2xs transition-colors disabled:opacity-50"
        title="Revisionssicheren Prüfbericht inklusive Audit-Trail (§ 17 ff. BeurkG) herunterladen"
      >
        {isExportingReport ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
        ) : (
          <FileCheck2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        )}
        <span>Prüfbericht (§ 17 BeurkG)</span>
      </button>

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
