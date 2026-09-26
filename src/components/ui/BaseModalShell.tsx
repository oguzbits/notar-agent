'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

export interface BaseModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  descriptionId?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

/**
 * Einheitliche Basisschale für Modaldialoge (Radix Dialog + Design-System Tokens).
 * Beseitigt duplizierte Backdrop-, Animation- und Close-Button-Strukturen gem. AGENTS.md.
 */
export const BaseModalShell: React.FC<BaseModalShellProps> = ({
  isOpen,
  onClose,
  title,
  description,
  descriptionId = 'modal-description',
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-xs duration-150" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            aria-describedby={description ? descriptionId : undefined}
            className={cn(
              'border-border bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 w-full space-y-6 rounded-2xl border p-6 shadow-2xl duration-150 focus:outline-hidden sm:p-8',
              maxWidthClass
            )}
          >
            {/* Header: Title, Description & Close Button */}
            <div className="border-border flex items-start justify-between border-b pb-4">
              <div>
                <Dialog.Title className="text-foreground text-xl font-bold tracking-tight">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description
                    id={descriptionId}
                    className="text-muted-foreground mt-1 text-base"
                  >
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-2 transition-colors"
                  aria-label="Schließen"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Modal Body */}
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
