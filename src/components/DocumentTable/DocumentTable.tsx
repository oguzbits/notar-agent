'use client';

import { FileText, Search, Plus, Trash2, ExternalLink, Loader2, RotateCw, Ban } from 'lucide-react';
import React, { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { DeletionReason } from '@/types/deletion';
import { DocumentListItem, CaseStatus, CASE_STATUS } from '@/types/document';
import { DossierJob, JOB_STATUS } from '@/types/jobs';
import { DeleteDossierDialog } from './DeleteDossierDialog';

export interface DocumentTableProps {
  documents: DocumentListItem[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentListItem) => void;
  onSelectJob?: (job: DossierJob) => void;
  onCreateNew: () => void;
  onDeleteDocument: (id: string, reason: DeletionReason) => Promise<boolean>;
  activeJobs?: DossierJob[];
  onRetryJob?: (jobId: string) => Promise<boolean | void>;
  onCancelJob?: (jobId: string) => Promise<boolean | void>;
  onDeleteJob?: (jobId: string) => Promise<boolean | void>;
}

export const DOCUMENT_FILTERS = {
  ALL: 'Alle',
  IN_PROGRESS: CASE_STATUS.IN_PROGRESS,
  DRAFT_READY: CASE_STATUS.DRAFT_READY,
} as const;

export type FilterStatus = (typeof DOCUMENT_FILTERS)[keyof typeof DOCUMENT_FILTERS];

export const getStatusBadge = (status?: CaseStatus) => {
  return <StatusBadge status={status || CASE_STATUS.IN_PROGRESS} size="sm" />;
};

function TableHeadColumns() {
  return (
    <thead className="border-border bg-muted/40 text-muted-foreground border-b text-sm font-semibold tracking-wider uppercase">
      <tr>
        <th className="px-4 py-3.5">Vorgang / Aktenzeichen</th>
        <th className="px-4 py-3.5">Typ</th>
        <th className="px-4 py-3.5">Status</th>
        <th className="px-4 py-3.5">Stand</th>
        <th className="px-4 py-3.5 text-right">Aktionen</th>
      </tr>
    </thead>
  );
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  isLoading,
  onSelectDocument,
  onSelectJob,
  onCreateNew,
  onDeleteDocument,
  activeJobs = [],
  onRetryJob,
  onCancelJob,
  onDeleteJob,
}) => {
  const { hasRolePermission } = useAuth();
  const canDelete = hasRolePermission(PERMISSION_ACTIONS.DELETE_DOSSIER);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>(DOCUMENT_FILTERS.ALL);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<DocumentListItem | null>(null);
  const [pendingDeleteJob, setPendingDeleteJob] = useState<DossierJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  const filteredDocuments = documents.filter((doc) => {
    const caseTypeStr = doc.caseType || '';
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseTypeStr.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === DOCUMENT_FILTERS.ALL) return true;
    const effectiveStatus: CaseStatus =
      doc.status === CASE_STATUS.DRAFT_READY ? CASE_STATUS.DRAFT_READY : CASE_STATUS.IN_PROGRESS;
    return effectiveStatus === activeFilter;
  });

  const filteredActiveJobs = activeJobs.filter((job) => {
    const title = job.payload.notes || 'Neuer Urkundenvorgang';
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.payload.caseType
        ? job.payload.caseType.toLowerCase().includes(searchQuery.toLowerCase())
        : false);

    if (!matchesSearch) return false;
    if (activeFilter === DOCUMENT_FILTERS.DRAFT_READY) return false; // Jobs in Bearbeitung sind noch nicht entwurfsreif
    return true;
  });

  const totalItemCount = filteredDocuments.length + filteredActiveJobs.length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch (_err) {
      return dateStr;
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!pendingDeleteJob || !onDeleteJob) return;
    const jobToDelete = pendingDeleteJob;
    setPendingDeleteJob(null);
    setIsDeleting(true);
    try {
      await onDeleteJob(jobToDelete.id);
    } catch (err) {
      console.error('Fehler beim Löschen des Jobs:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRetryJob || retryingJobId) return;
    setRetryingJobId(jobId);
    try {
      await onRetryJob(jobId);
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleCancelJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onCancelJob || cancellingJobId) return;
    setCancellingJobId(jobId);
    try {
      await onCancelJob(jobId);
    } finally {
      setCancellingJobId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Search Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
            Vorgangsübersicht
          </h1>
          <p className="text-muted-foreground mt-0.5 text-base">
            Alle erfassten notariellen Zuarbeiten und Vertragsakten in der Kanzlei
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold shadow-xs transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Neue Zuarbeit starten</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="border-border bg-card flex flex-col items-center justify-between gap-3 rounded-xl border p-3 shadow-xs sm:flex-row">
        {/* Filter Tabs */}
        <div className="bg-muted border-border flex w-full items-center rounded-lg border p-1 sm:w-auto">
          {Object.values(DOCUMENT_FILTERS).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={cn(
                'flex-1 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all sm:flex-none sm:text-base',
                activeFilter === tab
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Suchfeld */}
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4.5 w-4.5 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vorgang oder Aktenzeichen suchen..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border py-2 pr-3.5 pl-10 text-sm focus:ring-1 focus:outline-none sm:text-base"
          />
        </div>
      </div>

      {/* Tabelle */}
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
        {isLoading ? (
          <div className="overflow-x-auto" aria-busy="true" aria-label="Vorgänge werden geladen">
            <table className="w-full text-left">
              <TableHeadColumns />
              <tbody className="divide-border divide-y">
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-muted h-8 w-8 shrink-0 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <div className="bg-muted h-4 w-44 rounded" />
                          <div className="bg-muted h-3 w-28 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="bg-muted h-5 w-24 rounded-md" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-muted h-5 w-20 rounded-md" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-muted h-4 w-28 rounded" />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <div className="bg-muted h-8 w-8 rounded-lg" />
                        <div className="bg-muted h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : totalItemCount === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="border-border bg-muted/40 flex h-12 w-12 items-center justify-center rounded-full border">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-foreground text-base font-semibold">Keine Vorgänge gefunden</p>
              <p className="text-muted-foreground mt-1 text-base">
                {searchQuery
                  ? 'Keine Treffer für Ihren Suchbegriff.'
                  : 'Legen Sie Ihren ersten Vorgang zur Urkundenvorbereitung an.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={onCreateNew}
                className="border-border text-foreground hover:bg-muted mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-base font-medium transition-colors"
              >
                <Plus className="text-notar-800 h-4 w-4" />
                <span>Erste Akte anlegen</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <TableHeadColumns />
              <tbody className="divide-border divide-y">
                {/* 1. Laufende Hintergrund-Jobs direkt in der Tabelle */}
                {filteredActiveJobs.map((job) => {
                  const isRetrying = retryingJobId === job.id;
                  const isCancelling = cancellingJobId === job.id;
                  const isFailed = job.status === JOB_STATUS.FAILED;
                  const activity = isFailed
                    ? job.errorMessage || 'Verarbeitung fehlgeschlagen'
                    : job.progressDetails?.currentActivity ||
                      (job.status === JOB_STATUS.PENDING
                        ? 'In Warteschlange eingereiht...'
                        : 'Dokumente werden geprüft...');

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob?.(job)}
                      className={cn(
                        'bg-muted/30 border-l-notar-700 border-l-4 transition-colors',
                        onSelectJob && 'hover:bg-muted/50 cursor-pointer'
                      )}
                    >
                      {/* Titel & Status */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="border-border bg-notar-100 text-notar-800 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                            {isFailed ? (
                              <RotateCw className="text-destructive h-4 w-4" />
                            ) : (
                              <Loader2 className="text-notar-800 h-4 w-4 animate-spin" />
                            )}
                          </div>
                          <div>
                            <span className="text-foreground block font-semibold">
                              {job.payload.notes
                                ? job.payload.notes.slice(0, 50)
                                : 'Neuer Urkundenvorgang'}
                            </span>
                            <span
                              className={cn(
                                'text-sm',
                                isFailed ? 'text-destructive font-medium' : 'text-muted-foreground'
                              )}
                            >
                              {activity}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Typ */}
                      <td className="text-muted-foreground px-4 py-3.5">
                        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm">
                          {job.payload.caseType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={job.status} size="sm" />
                      </td>

                      {/* Datum */}
                      <td className="text-muted-foreground px-5 py-3.5 font-mono text-sm">
                        {formatDate(job.createdAt)}
                      </td>

                      {/* Aktionen: Bei FAILED Wiederholen, bei PENDING/PROCESSING Abbrechen */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {job.status === JOB_STATUS.FAILED && (
                            <>
                              {onRetryJob && (
                                <button
                                  type="button"
                                  disabled={isRetrying}
                                  onClick={(e) => handleRetryJob(job.id, e)}
                                  className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm"
                                  title="Vorgang erneut starten"
                                >
                                  {isRetrying ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCw className="h-4 w-4" />
                                  )}
                                  <span>Wiederholen</span>
                                </button>
                              )}
                              {onDeleteJob && (
                                <button
                                  type="button"
                                  disabled={!canDelete}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingDeleteJob(job);
                                  }}
                                  className={cn(
                                    'focus-visible:ring-destructive flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2',
                                    canDelete
                                      ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                      : 'text-muted-foreground cursor-not-allowed opacity-30'
                                  )}
                                  title={
                                    canDelete
                                      ? 'Fehlgeschlagenen Vorgang verwerfen'
                                      : 'Vorgänge können nur durch Notare oder Administratoren gelöscht werden'
                                  }
                                  aria-label="Fehlgeschlagenen Vorgang verwerfen"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}

                          {(job.status === JOB_STATUS.PENDING ||
                            job.status === JOB_STATUS.PROCESSING) &&
                            onCancelJob && (
                              <button
                                type="button"
                                disabled={isCancelling}
                                onClick={(e) => handleCancelJob(job.id, e)}
                                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm"
                                title="Vorgang abbrechen"
                              >
                                {isCancelling ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                                <span>Abbrechen</span>
                              </button>
                            )}

                          {job.status !== JOB_STATUS.FAILED && !onCancelJob && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled
                                className="text-muted-foreground/40 flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg"
                                title="Vorgang wird noch analysiert"
                                aria-label="Vorgang wird analysiert"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled
                                className="text-muted-foreground/40 flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg"
                                title="Vorgang wird noch analysiert"
                                aria-label="Vorgang wird analysiert"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 2. Persistierte Dokumente */}
                {filteredDocuments.map((doc) => {
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onSelectDocument(doc)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      {/* Titel & Icon */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="border-border bg-muted/60 text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                            <FileText className="text-notar-800 h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="text-foreground block font-semibold">{doc.title}</span>
                            <span className="text-muted-foreground font-mono text-sm">
                              ID: {doc.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Typ */}
                      <td className="text-muted-foreground px-4 py-3.5">
                        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm">
                          {doc.caseType
                            ? doc.caseType.charAt(0) +
                              doc.caseType.slice(1).toLowerCase().replace(/_/g, ' ')
                            : 'Immobilienkauf'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusBadge(doc.status)}
                      </td>

                      {/* Datum */}
                      <td className="text-muted-foreground px-5 py-3.5 font-mono text-sm">
                        {formatDate(doc.created_at)}
                      </td>

                      {/* Aktionen */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectDocument(doc)}
                            className="hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-notar-900 flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2"
                            title="Vorgang öffnen"
                            aria-label={`Vorgang ${doc.title} öffnen`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteDoc(doc);
                            }}
                            className={cn(
                              'focus-visible:ring-destructive flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2',
                              canDelete
                                ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                : 'text-muted-foreground cursor-not-allowed opacity-30'
                            )}
                            title={
                              canDelete
                                ? 'Vorgang löschen'
                                : 'Vorgänge können nur durch Notare oder Administratoren gelöscht werden'
                            }
                            aria-label={`Vorgang ${doc.title} löschen`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingDeleteDoc && (
        <DeleteDossierDialog
          dossierTitle={pendingDeleteDoc.title || 'diese Akte'}
          onConfirm={(reason) => onDeleteDocument(pendingDeleteDoc.id, reason)}
          onClose={() => setPendingDeleteDoc(null)}
        />
      )}

      {/* Bestätigungsdialog für das Verwerfen/Löschen fehlgeschlagener Hintergrund-Jobs */}
      <ConfirmDialog
        isOpen={Boolean(pendingDeleteJob)}
        isLoading={isDeleting}
        onClose={() => setPendingDeleteJob(null)}
        onConfirm={handleConfirmDeleteJob}
        title="Fehlgeschlagenen Vorgang verwerfen?"
        description={
          <span>
            Möchten Sie den fehlgeschlagenen Vorgang{' '}
            <strong className="text-foreground font-semibold">
              {pendingDeleteJob?.payload.notes || 'diese Vorbereitung'}
            </strong>{' '}
            wirklich verwerfen und aus der Kanzleiübersicht entfernen?
          </span>
        }
        confirmLabel="Vorgang verwerfen"
        cancelLabel="Abbrechen"
        variant="danger"
      />
    </div>
  );
};
