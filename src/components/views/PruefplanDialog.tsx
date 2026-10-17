'use client';

import { Loader2 } from 'lucide-react';
import React from 'react';
import { BaseModalShell } from '@/components/ui/BaseModalShell';
import { Button } from '@/components/ui/Button';
import { usePruefplan } from '@/hooks/usePruefplan';
import { PRUEFPLAN_UI_TEXTS_DE as T } from '@/lib/dossier/constants';
import { CaseType, UploadedFilePayload } from '@/types/dossier';
import { KNOWLEDGE_REVIEW_STATUS } from '@/types/knowledge';
import { Pruefplan } from '@/types/pruefplan';

interface PruefplanDialogProps {
  isOpen: boolean;
  caseType: CaseType;
  files: UploadedFilePayload[];
  onCancel: () => void;
  onStart: () => void;
}

function PruefplanBody({ plan, files }: { plan: Pruefplan; files: UploadedFilePayload[] }) {
  return (
    <>
      <section>
        <h3 className="text-foreground text-base font-bold">{T.DOCUMENTS}</h3>
        <ul className="text-foreground mt-1 list-disc pl-5 text-base">
          {files.map((f) => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-foreground text-base font-bold">{T.FIELDS}</h3>
        {plan.fields.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-base">{T.FIELDS_EMPTY}</p>
        ) : (
          <ul className="text-foreground mt-1 list-disc pl-5 text-base sm:columns-2">
            {plan.fields.map((f) => (
              <li key={f.fieldKey}>{f.title}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-foreground text-base font-bold">{T.RULES}</h3>
        {plan.rules.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-base">{T.RULES_EMPTY}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {plan.rules.map((r) => (
              <li key={r.id} className="text-foreground text-base">
                {r.title}{' '}
                <span className="text-muted-foreground text-sm">
                  ({r.legalBasis},{' '}
                  {r.reviewStatus === KNOWLEDGE_REVIEW_STATUS.GEPRUEFT
                    ? T.RULE_REVIEWED
                    : T.RULE_UNREVIEWED}
                  )
                </span>
              </li>
            ))}
          </ul>
        )}
        {!plan.ruleBasisReviewed && (
          <p className="border-warning/60 bg-warning/10 text-foreground mt-2 rounded border-l-3 px-3 py-1.5 text-base">
            {T.WARNING}
          </p>
        )}
      </section>
    </>
  );
}

export const PruefplanDialog: React.FC<PruefplanDialogProps> = ({
  isOpen,
  caseType,
  files,
  onCancel,
  onStart,
}) => {
  const { data: plan, isLoading, isError, refetch } = usePruefplan(caseType, isOpen);

  return (
    <BaseModalShell
      isOpen={isOpen}
      onClose={onCancel}
      title={T.TITLE}
      description={T.DESCRIPTION}
      descriptionId="pruefplan-description"
      maxWidthClass="max-w-2xl"
    >
      <div className="max-h-96 min-h-48 space-y-5 overflow-y-auto">
        {isLoading && (
          <div className="text-muted-foreground flex items-center gap-3 text-base" role="status">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{T.LOADING}</span>
          </div>
        )}

        {isError && (
          <div className="space-y-3" role="alert">
            <p className="text-destructive text-base">{T.ERROR}</p>
            <Button type="button" variant="outline" size="md" onClick={() => refetch()}>
              {T.RETRY}
            </Button>
          </div>
        )}

        {plan && <PruefplanBody plan={plan} files={files} />}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          {T.CANCEL}
        </Button>
        <Button type="button" size="md" disabled={!plan} onClick={onStart}>
          {T.START}
        </Button>
      </div>
    </BaseModalShell>
  );
};
