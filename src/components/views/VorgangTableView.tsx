'use client';

import React from 'react';
import { DocumentTable } from '@/components/DocumentTable';
import { DocumentRecord } from '@/lib/supabase/server';
import { DossierJob } from '@/types/jobs';

interface VorgangTableViewProps {
  documents: DocumentRecord[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentRecord) => void;
  onSelectJob?: (job: DossierJob) => void;
  onCreateNew: () => void;
  onDeleteDocument: (id: string) => Promise<void>;
  activeJobs?: DossierJob[];
  onRetryJob?: (jobId: string) => Promise<boolean | void>;
}

export const VorgangTableView: React.FC<VorgangTableViewProps> = ({
  documents,
  isLoading,
  onSelectDocument,
  onSelectJob,
  onCreateNew,
  onDeleteDocument,
  activeJobs = [],
  onRetryJob,
}) => {
  return (
    <DocumentTable
      documents={documents}
      isLoading={isLoading}
      onSelectDocument={onSelectDocument}
      onSelectJob={onSelectJob}
      onCreateNew={onCreateNew}
      onDeleteDocument={onDeleteDocument}
      activeJobs={activeJobs}
      onRetryJob={onRetryJob}
    />
  );
};
