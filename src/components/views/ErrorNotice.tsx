import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UEBERSICHT_FEHLER_TEXTS_DE } from '@/lib/dossier/constants';

interface ErrorNoticeProps {
  message: string;
  /** Zeigt „Erneut laden“, wenn gesetzt. */
  onRetry?: () => void;
  /** Zeigt „Meldung schließen“, wenn gesetzt. */
  onDismiss?: () => void;
}

export function ErrorNotice({ message, onRetry, onDismiss }: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/10 text-destructive flex flex-wrap items-center gap-3 rounded-lg border p-4 text-base"
    >
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">{message}</span>
      {onRetry && (
        <Button type="button" variant="outline" size="md" onClick={onRetry}>
          {UEBERSICHT_FEHLER_TEXTS_DE.RETRY}
        </Button>
      )}
      {onDismiss && (
        <Button type="button" variant="ghost" size="md" onClick={onDismiss}>
          {UEBERSICHT_FEHLER_TEXTS_DE.DISMISS}
        </Button>
      )}
    </div>
  );
}
