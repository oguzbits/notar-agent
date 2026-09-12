import { FileText, StickyNote } from 'lucide-react';
import React from 'react';

interface SourcePillProps {
  fileName: string;
  pageNumber?: number;
  className?: string;
}

export const SourcePill: React.FC<SourcePillProps> = ({ fileName, pageNumber, className = '' }) => {
  const isNote = fileName.toLowerCase().startsWith('notiz');

  return (
    <span
      className={`bg-muted/60 text-foreground inline-flex items-center gap-1 rounded border border-slate-200/50 px-1.5 py-0.5 text-[11px] font-medium ${className}`}
      title={fileName}
    >
      {isNote ? (
        <StickyNote className="h-3 w-3 shrink-0 text-[#E08A00]" />
      ) : (
        <FileText className="h-3 w-3 shrink-0 text-[#356611]" />
      )}
      <span className="max-w-[200px] truncate">{fileName}</span>
      {pageNumber ? (
        <span className="text-muted-foreground shrink-0 font-normal">(S. {pageNumber})</span>
      ) : null}
    </span>
  );
};
