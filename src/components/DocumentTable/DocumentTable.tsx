'use client';

import { FileText, Search, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { DocumentRecord } from '@/lib/supabase/server';

interface DocumentTableProps {
  documents: DocumentRecord[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentRecord) => void;
  onCreateNew: () => void;
  onDeleteDocument: (id: string) => Promise<void>;
}

export type FilterStatus = 'Alle' | 'In Prüfung' | 'Entwurfsreif';

export const getStatusBadge = (status?: string) => {
  return <StatusBadge status={(status || 'In Prüfung') as StatusVariant} size="sm" />;
};

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  isLoading,
  onSelectDocument,
  onCreateNew,
  onDeleteDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('Alle');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.content?.caseTitle || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === 'Alle') return true;
    const effectiveStatus =
      doc.status === 'Entwurfsreif' || (doc.status as string) === 'Beurkundet'
        ? 'Entwurfsreif'
        : 'In Prüfung';
    return effectiveStatus === activeFilter;
  });

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
    } catch {
      return dateStr;
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Möchten Sie diesen Vorgang wirklich unwiderruflich löschen?')) {
      return;
    }
    setDeletingId(id);
    try {
      await onDeleteDocument(id);
    } finally {
      setDeletingId(null);
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
          {(['Alle', 'In Prüfung', 'Entwurfsreif'] as FilterStatus[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:flex-none sm:text-base ${
                activeFilter === tab
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Suchfeld */}
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vorgang oder Aktenzeichen suchen..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-1 focus:outline-none sm:text-base"
          />
        </div>
      </div>

      {/* Tabelle */}
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
        {isLoading ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 p-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#4D9619]" />
            <span className="text-base font-medium">Vorgänge werden geladen...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
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
                <Plus className="h-4 w-4 text-[#4D9619]" />
                <span>Erste Akte anlegen</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-sm font-semibold tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-3.5">Vorgang &amp; Aktenzeichen</th>
                  <th className="px-4 py-3.5">Typ</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Stand</th>
                  <th className="px-4 py-3.5 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
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
                          <div className="border-border bg-muted/60 text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                            <FileText className="h-4 w-4 text-[#4D9619]" />
                          </div>
                          <div>
                            <span className="text-foreground block font-semibold">{doc.title}</span>
                            <span className="text-muted-foreground font-mono text-xs">
                              ID: {doc.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Typ */}
                      <td className="text-muted-foreground px-4 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {doc.content?.caseType
                            ? doc.content.caseType.charAt(0) +
                              doc.content.caseType.slice(1).toLowerCase().replace(/_/g, ' ')
                            : 'Immobilienkauf'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusBadge(doc.status)}
                      </td>

                      {/* Datum */}
                      <td className="text-muted-foreground px-5 py-3.5 font-mono">
                        {formatDate(doc.created_at)}
                      </td>

                      {/* Aktionen */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectDocument(doc)}
                            className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[#356611]"
                            title="Vorgang öffnen"
                            aria-label={`Vorgang ${doc.title} öffnen`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === doc.id}
                            onClick={(e) => handleDelete(doc.id, e)}
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
                            title="Vorgang löschen"
                            aria-label={`Vorgang ${doc.title} löschen`}
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
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
    </div>
  );
};
