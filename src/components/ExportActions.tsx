import { Download, FileCheck2, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { EXPORT_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { downloadJsonFile, downloadTextFile, generatePruefberichtText } from '@/lib/export';
import { Dossier } from '@/types/dossier';

interface ExportActionsProps {
  dossier: Dossier;
  documentId?: string;
}

async function buildPruefbericht(dossier: Dossier, documentId?: string): Promise<string> {
  if (!documentId) return generatePruefberichtText(dossier, undefined);
  // Ohne Prüfprotokoll kein Bericht: ein Bericht ohne Protokoll wäre nicht revisionssicher
  const res = await fetch(`/api/documents/${documentId}/audit`);
  if (!res.ok) throw new Error(`Prüfprotokoll: HTTP ${res.status}`);
  const data = await res.json();
  return generatePruefberichtText(dossier, {
    history: data.history,
    integrityValid: data.integrity?.valid,
  });
}

export const ExportActions: React.FC<ExportActionsProps> = ({ dossier, documentId }) => {
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const downloadJson = () => {
    const fileName = `dossier_${dossier.caseTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    downloadJsonFile(fileName, dossier);
  };

  const downloadPruefbericht = async () => {
    setIsExportingReport(true);
    setExportError(null);
    try {
      const reportText = await buildPruefbericht(dossier, documentId);
      const safeTitle = (dossier.caseTitle || 'vorgang').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadTextFile(`pruefbericht_${safeTitle}.txt`, reportText);
    } catch (err) {
      console.error('Prüfbericht-Export fehlgeschlagen:', err);
      setExportError(EXPORT_UI_TEXTS_DE.AUDIT_FEHLT);
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
        title="Revisionssicheren Prüfbericht inklusive lückenlosem Audit-Trail herunterladen"
      >
        {isExportingReport ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : (
          <FileCheck2 className="text-notar-700 dark:text-notar-400 h-4 w-4" />
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

      {exportError && (
        <p role="alert" className="text-destructive w-full text-base font-medium">
          {exportError}
        </p>
      )}
    </div>
  );
};
