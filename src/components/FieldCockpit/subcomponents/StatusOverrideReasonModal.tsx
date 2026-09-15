import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Check, X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

interface StatusOverrideReasonModalProps {
  isOpen: boolean;
  fieldTitle: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const ReasonDialogContent: React.FC<{
  fieldTitle: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ fieldTitle, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isReasonValid = reason.trim().length >= 3;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasSubmitted(true);
    if (isReasonValid) {
      onConfirm(reason.trim());
    }
  };

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-xs duration-150" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          aria-describedby="audit-modal-description"
          className="border-border bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 w-full max-w-lg space-y-4 rounded-xl border p-6 shadow-xl duration-150 focus:outline-hidden"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-base font-semibold">
                  Revisionsbegründung erfassen (§ 17 ff. BeurkG)
                </Dialog.Title>
                <p className="text-muted-foreground text-sm">
                  Feld: <strong className="text-foreground">{fieldTitle}</strong>
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-1 transition-colors"
                aria-label="Dialog schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description
            id="audit-modal-description"
            className="text-muted-foreground text-sm leading-relaxed"
          >
            Sie markieren dieses Feld als{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">„Belegt“</strong>. Für die
            revisionssichere Kanzleiakte und den gerichtsfesten Prüfbericht muss der Grund für die
            Freigabe dokumentiert werden (z. B.{' '}
            <em>„Originaler Erbschein lag bei Beurkundung vor“</em>).
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="audit-reason-input"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Begründung für die Akte <span className="text-destructive">*</span>
              </label>
              <textarea
                id="audit-reason-input"
                ref={inputRef}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="z. B. Einsichtnahme in das Handelsregister genommen / Vollmacht liegt im Original vor..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-notar-900 w-full rounded-md border p-2.5 text-sm focus:ring-2 focus:outline-none"
              />
              {hasSubmitted && !isReasonValid && (
                <p className="text-destructive mt-1 text-xs font-medium">
                  Bitte geben Sie eine aussagekräftige Begründung an (mindestens 3 Zeichen).
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="border-border bg-background text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center rounded-md border px-3.5 py-2 text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={hasSubmitted && !isReasonValid}
                className="bg-notar-500 text-notar-950 hover:bg-notar-600 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>Freigabe im Audit-Trail quittieren</span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </div>
    </Dialog.Portal>
  );
};

export const StatusOverrideReasonModal: React.FC<StatusOverrideReasonModalProps> = ({
  isOpen,
  fieldTitle,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      {isOpen && (
        <ReasonDialogContent
          key={fieldTitle}
          fieldTitle={fieldTitle}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </Dialog.Root>
  );
};
