import { FileText, ChevronDown, ChevronUp, Quote, StickyNote } from 'lucide-react';
import React, { useState } from 'react';
import { SourcePill } from '@/components/ui/SourcePill';
import { parseSourceLocations } from '@/lib/dossier';
import { SourceLocation } from '@/types/dossier';

interface SourceAuditDrawerProps {
  source?: SourceLocation | null;
}

export const SourceAuditDrawer: React.FC<SourceAuditDrawerProps> = ({ source }) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasSource = Boolean(source && source.fileName && source.fileName.trim().length > 0);

  if (!hasSource) {
    return null;
  }

  const validSource = source!;
  const subSources = parseSourceLocations(validSource);

  if (subSources.length === 0) {
    return null;
  }

  return (
    <div className="border-border mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="source-audit-drawer-content"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-primary flex w-full cursor-pointer items-center justify-between rounded p-0.5 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        <div className="flex flex-wrap items-center gap-1.5 truncate">
          <FileText className="text-notar-600 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground">Quellen:</span>
          {subSources.map((s, idx) => (
            <SourcePill key={idx} fileName={s.fileName} pageNumber={s.pageNumber} />
          ))}
        </div>
        {isOpen ? (
          <ChevronUp
            className="text-muted-foreground ml-2 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="text-muted-foreground ml-2 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div id="source-audit-drawer-content" className="mt-2 space-y-2">
          {subSources.length > 1 ? (
            <div className="space-y-1.5">
              {subSources.map((s, idx) => {
                const isNote = s.fileName.toLowerCase().startsWith('notiz');
                return (
                  <div
                    key={idx}
                    className="bg-muted/40 border-border rounded-lg border p-2 text-xs"
                  >
                    <div className="text-foreground flex items-center gap-1.5 pb-1 font-semibold">
                      {isNote ? (
                        <StickyNote className="h-3 w-3 text-amber-600" />
                      ) : (
                        <FileText className="text-notar-800 h-3 w-3" />
                      )}
                      <span>{s.fileName}</span>
                      {s.pageNumber ? (
                        <span className="text-muted-foreground font-normal">
                          (S. {s.pageNumber})
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-2xs pl-4 font-mono whitespace-pre-wrap italic select-text">
                      {s.snippet ? (
                        `"${s.snippet}"`
                      ) : (
                        <span className="text-muted-foreground font-sans not-italic">
                          Belegt Datenpunkte aus dem Gesamt-Nachweis: &quot;{validSource.snippet}
                          &quot;
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-muted/60 border-border text-foreground relative rounded-lg border p-2 pl-6 text-xs">
              <Quote className="text-muted-foreground absolute top-2 left-1.5 h-3 w-3" />
              <div className="text-foreground text-2xs flex items-center gap-1.5 pb-1 font-semibold">
                {subSources[0].fileName.toLowerCase().startsWith('notiz') ? (
                  <StickyNote className="h-3 w-3 text-amber-600" />
                ) : (
                  <FileText className="text-notar-800 h-3 w-3" />
                )}
                <span>{subSources[0].fileName}</span>
                {subSources[0].pageNumber ? (
                  <span className="text-muted-foreground font-normal">
                    (S. {subSources[0].pageNumber})
                  </span>
                ) : null}
              </div>
              <p className="text-2xs font-mono leading-relaxed whitespace-pre-wrap italic select-text">
                &quot;{validSource.snippet}&quot;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
