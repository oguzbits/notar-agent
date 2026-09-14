import { AlertCircle, Check, X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

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

  const containerRef = useClickOutside<HTMLDivElement>(onCancel, {
    enabled: true,
    onEscape: true,
  });

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={containerRef}
        className="border-border bg-card text-card-foreground w-full max-w-lg space-y-4 rounded-xl border p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="audit-modal-title" className="text-foreground text-base font-semibold">
                Revisionsbegründung erfassen (§ 17 ff. BeurkG)
              </h3>
              <p className="text-muted-foreground text-sm">
                Feld: <strong className="text-foreground">{fieldTitle}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
            aria-label="Dialog schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">
          Sie markieren dieses Feld als{' '}
          <strong className="text-emerald-700 dark:text-emerald-400">„Belegt“</strong>. Für die
          revisionssichere Kanzleiakte und den gerichtsfesten Prüfbericht muss der Grund für die
          Freigabe dokumentiert werden (z. B.{' '}
          <em>„Originaler Erbschein lag bei Beurkundung vor“</em>).
        </p>

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
      </div>
    </div>
  );
};

export const StatusOverrideReasonModal: React.FC<StatusOverrideReasonModalProps> = ({
  isOpen,
  fieldTitle,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <ReasonDialogContent
      key={fieldTitle}
      fieldTitle={fieldTitle}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
