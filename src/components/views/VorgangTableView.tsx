'use client';

import React from 'react';
import { DocumentRecord } from '@/lib/supabase/server';
import { DocumentTable } from '@/components/DocumentTable/DocumentTable';

interface VorgangTableViewProps {
  documents: DocumentRecord[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentRecord) => void;
  onCreateNew: () => void;
  onDeleteDocument: (id: string) => Promise<void>;
}

export const VorgangTableView: React.FC<VorgangTableViewProps> = ({
  documents,
  isLoading,
  onSelectDocument,
  onCreateNew,
  onDeleteDocument,
}) => {
  return (
    <DocumentTable
      documents={documents}
      isLoading={isLoading}
      onSelectDocument={onSelectDocument}
      onCreateNew={onCreateNew}
      onDeleteDocument={onDeleteDocument}
    />
  );
};
