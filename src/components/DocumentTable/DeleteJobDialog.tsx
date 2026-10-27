'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { DossierJob } from '@/types/jobs';

interface DeleteJobDialogProps {
  job: DossierJob;
  /** Liefert `false` bei Misserfolg; `void` gilt als Erfolg. */
  onDeleteJob?: (jobId: string) => Promise<boolean | void>;
  onClose: () => void;
}

/** Bleibt bis zum Ergebnis offen; wird nur bei Bedarf eingehängt, damit der Fehlerzustand neu beginnt. */
export function DeleteJobDialog({ job, onDeleteJob, onClose }: DeleteJobDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleConfirm = async () => {
    if (isPending || !onDeleteJob) return;
    setIsPending(true);
    setHasError(false);
    let deleted: boolean | void = false;
    try {
      deleted = await onDeleteJob(job.id);
    } catch (err) {
      console.error('Fehler beim Löschen des Jobs:', err);
    }
    setIsPending(false);
    if (deleted === false) setHasError(true);
    else onClose();
  };

  return (
    <ConfirmDialog
      isOpen
      isLoading={isPending}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Fehlgeschlagenen Vorgang verwerfen?"
      description={
        <span className="block space-y-3">
          <span className="block">
            Möchten Sie den fehlgeschlagenen Vorgang{' '}
            <strong className="text-foreground font-semibold">
              {job.payload.notes || 'diese Vorbereitung'}
            </strong>{' '}
            wirklich verwerfen und aus der Kanzleiübersicht entfernen?
          </span>
          {hasError && (
            <span role="alert" className="text-destructive block font-semibold">
              {DELETION_UI_TEXTS_DE.ERROR}
            </span>
          )}
        </span>
      }
      confirmLabel={hasError ? DELETION_UI_TEXTS_DE.RETRY : 'Vorgang verwerfen'}
      cancelLabel="Abbrechen"
      variant="danger"
    />
  );
}
