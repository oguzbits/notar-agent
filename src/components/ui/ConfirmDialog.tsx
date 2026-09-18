'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  variant = 'danger',
  isLoading = false,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-xs duration-150" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            role="alertdialog"
            aria-describedby="confirm-dialog-description"
            className="border-border bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 w-full max-w-md space-y-5 rounded-2xl border p-6 shadow-2xl duration-150 focus:outline-hidden"
          >
            <div className="flex items-start gap-4">
              {variant === 'danger' && (
                <div className="bg-destructive/10 text-destructive flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              <div className="space-y-1.5">
                <Dialog.Title className="text-foreground text-lg font-bold tracking-tight">
                  {title}
                </Dialog.Title>
                <Dialog.Description
                  id="confirm-dialog-description"
                  className="text-muted-foreground text-base leading-relaxed"
                >
                  {description}
                </Dialog.Description>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isLoading}
                onClick={onClose}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={variant === 'danger' ? 'danger' : 'primary'}
                size="md"
                isLoading={isLoading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
