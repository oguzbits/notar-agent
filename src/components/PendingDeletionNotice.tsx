'use client';

import { Button, Card } from '@/components/ui';
import { usePendingDeletions } from '@/hooks/usePendingDeletions';
import { DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';

export function PendingDeletionNotice({ organizationId }: { organizationId?: string }) {
  const { pendingFiles, isLoading, isError, retry } = usePendingDeletions(organizationId);

  if (isLoading) {
    return (
      <Card className="px-4 py-3">
        <p className="text-muted-foreground animate-pulse text-sm">
          {DELETION_UI_TEXTS_DE.PENDING_LOADING}
        </p>
      </Card>
    );
  }
  if (isError) {
    return (
      <Card role="alert" className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="text-destructive text-base font-semibold">
          {DELETION_UI_TEXTS_DE.PENDING_ERROR}
        </p>
        <Button variant="secondary" size="sm" onClick={() => retry()}>
          {DELETION_UI_TEXTS_DE.RETRY}
        </Button>
      </Card>
    );
  }
  if (pendingFiles === 0) return null;
  return (
    <Card role="status" className="px-4 py-3">
      <p className="text-foreground text-base">
        {DELETION_UI_TEXTS_DE.PENDING_NOTICE(pendingFiles)}
      </p>
    </Card>
  );
}
