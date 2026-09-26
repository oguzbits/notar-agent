'use client';

import { Building2, UserPlus, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';
import { BaseModalShell, Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';

interface OrganizationGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrganizationGatewayModal: React.FC<OrganizationGatewayModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { createOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Formular-State für Neugründung
  const [name, setName] = useState('');
  const [officialSeat, setOfficialSeat] = useState('');
  const [chamberDistrict, setChamberDistrict] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedSeat = officialSeat.trim();
    const trimmedDistrict = chamberDistrict.trim();

    if (!trimmedName || !trimmedSeat || !trimmedDistrict) {
      setErrorMessage('Bitte füllen Sie alle Kanzlei-Pflichtangaben aus.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createOrganization({
        name: trimmedName,
        officialSeat: trimmedSeat,
        chamberDistrict: trimmedDistrict,
      });
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Kanzlei konnte nicht eingerichtet werden.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Kanzlei einrichten oder beitreten"
      description="Für die notarielle Urkundenprüfung ist eine Kanzleizuweisung erforderlich."
      descriptionId="org-gateway-description"
      maxWidthClass="max-w-lg"
    >
      {/* Tab-Auswahl (Gründen vs. Beitreten) */}
      <div className="bg-muted flex rounded-xl p-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('create');
            setErrorMessage(null);
          }}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2 text-base font-semibold transition-colors',
            activeTab === 'create'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Building2 className="h-4 w-4" />
          <span>Kanzlei gründen</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('join');
            setErrorMessage(null);
          }}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-2 text-base font-semibold transition-colors',
            activeTab === 'join'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserPlus className="h-4 w-4" />
          <span>Kanzlei beitreten</span>
        </button>
      </div>

      {errorMessage && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3 rounded-xl border p-3.5 text-base">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: Kanzlei gründen */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="gateway-org-name"
              className="text-foreground block text-base font-medium"
            >
              Name der Kanzlei / des Notariats
            </label>
            <Input
              id="gateway-org-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Notariat am Rathausmarkt"
              containerClassName="mt-1 w-full"
            />
          </div>

          <div>
            <label
              htmlFor="gateway-org-seat"
              className="text-foreground block text-base font-medium"
            >
              Amtssitz
            </label>
            <Input
              id="gateway-org-seat"
              type="text"
              required
              value={officialSeat}
              onChange={(e) => setOfficialSeat(e.target.value)}
              placeholder="z. B. Hamburg"
              containerClassName="mt-1 w-full"
            />
          </div>

          <div>
            <label
              htmlFor="gateway-org-chamber"
              className="text-foreground block text-base font-medium"
            >
              Notarkammerbezirk
            </label>
            <Input
              id="gateway-org-chamber"
              type="text"
              required
              value={chamberDistrict}
              onChange={(e) => setChamberDistrict(e.target.value)}
              placeholder="z. B. Hamburgische Notarkammer"
              containerClassName="mt-1 w-full"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
            >
              Kanzlei anlegen &amp; starten
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: Kanzlei beitreten */}
      {activeTab === 'join' && (
        <div className="bg-muted/40 border-border space-y-4 rounded-xl border p-6 text-center">
          <div className="bg-notar-100 text-notar-900 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <UserPlus className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-foreground text-base font-semibold">Bestehendem Team beitreten</h4>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Bitten Sie die Notarin, den Notar oder Administrator Ihrer Kanzlei, Ihnen eine
              Einladung an Ihre angemeldete E-Mail-Adresse zu senden.
            </p>
          </div>
          <div className="border-border border-t pt-3">
            <p className="text-muted-foreground text-xs">
              Sobald Sie eingeladen wurden, wird Ihre Kanzleizuweisung bei der nächsten
              Aktualisierung automatisch übernommen.
            </p>
          </div>
        </div>
      )}
    </BaseModalShell>
  );
};
