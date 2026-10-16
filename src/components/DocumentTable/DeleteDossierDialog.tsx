'use client';

import { useState } from 'react';
import { Button, ConfirmDialog } from '@/components/ui';
import { DELETION_REASON_LABELS_DE, DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { DeletionReason, DeletionReasonSchema } from '@/types/deletion';

interface DeleteDossierDialogProps {
  dossierTitle: string;
  /** Liefert `true`, wenn der Vorgang gelöscht wurde. */
  onConfirm: (reason: DeletionReason) => Promise<boolean>;
  onClose: () => void;
}

/** Wird nur bei Bedarf eingehängt, damit Grund und Fehlerzustand bei jedem Öffnen neu beginnen. */
export function DeleteDossierDialog({
  dossierTitle,
  onConfirm,
  onClose,
}: DeleteDossierDialogProps) {
  const [reason, setReason] = useState<DeletionReason | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleConfirm = async () => {
    if (!reason || isPending) return;
    setIsPending(true);
    setHasError(false);
    const deleted = await onConfirm(reason);
    setIsPending(false);
    if (deleted) onClose();
    else setHasError(true);
  };

  return (
    <ConfirmDialog
      isOpen
      isLoading={isPending}
      confirmDisabled={!reason}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={DELETION_UI_TEXTS_DE.DIALOG_TITLE}
      confirmLabel={hasError ? DELETION_UI_TEXTS_DE.RETRY : DELETION_UI_TEXTS_DE.CONFIRM}
      description={
        <span className="block space-y-4">
          <span className="block">
            <strong className="text-foreground font-semibold">{dossierTitle}</strong>
            {' – '}
            {DELETION_UI_TEXTS_DE.DIALOG_DESCRIPTION}
          </span>
          <span className="block space-y-2">
            <span className="text-foreground block font-semibold">
              {DELETION_UI_TEXTS_DE.REASON_LABEL}
            </span>
            <span
              role="group"
              aria-label={DELETION_UI_TEXTS_DE.REASON_LABEL}
              className="flex flex-wrap gap-2"
            >
              {DeletionReasonSchema.options.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="md"
                  variant={reason === option ? 'primary' : 'outline'}
                  aria-pressed={reason === option}
                  disabled={isPending}
                  onClick={() => setReason(option)}
                >
                  {DELETION_REASON_LABELS_DE[option]}
                </Button>
              ))}
            </span>
          </span>
          {hasError && (
            <span role="alert" className="text-destructive block font-semibold">
              {DELETION_UI_TEXTS_DE.ERROR}
            </span>
          )}
        </span>
      }
    />
  );
}
