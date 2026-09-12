import React, { useState } from 'react';
import { FieldStatus, SourceLocation } from '@/types/dossier';
import { StatusBadge } from './StatusBadge';
import { SourceAuditDrawer } from './SourceAuditDrawer';
import {
  AlertCircle,
  ArrowRight,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Edit3,
} from 'lucide-react';

interface FieldCardProps {
  index: number;
  title: string;
  subtitle: string;
  status: FieldStatus;
  source?: SourceLocation | null;
  note?: string | null;
  actionRequired?: string | null;
  onStatusOverride?: (newStatus: FieldStatus, customNote?: string) => void;
  children: React.ReactNode;
}

export const FieldCard: React.FC<FieldCardProps> = ({
  index,
  title,
  subtitle,
  status,
  source,
  note,
  actionRequired,
  onStatusOverride,
  children,
}) => {
  const isMissing = status === 'MISSING';
  // Standardmäßig eingeklappt, wenn das Feld noch aussteht (MISSING), sonst ausgeklappt
  const [isExpanded, setIsExpanded] = useState(!isMissing);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [userNote, setUserNote] = useState('');

  const [targetStatus, setTargetStatus] = useState<FieldStatus>(status);

  const handleSaveStatus = (overrideStatus?: FieldStatus) => {
    if (onStatusOverride) {
      const finalStatus = overrideStatus || targetStatus;
      onStatusOverride(finalStatus, userNote ? `[Manuell angepasst]: ${userNote}` : userNote);
      setIsEditingNote(false);
    }
  };

  return (
    <div
      className={`bg-card text-card-foreground border-border flex flex-col justify-between rounded-xl border transition-all ${
        isMissing && !isExpanded
          ? 'bg-slate-50/50 p-2.5 hover:border-slate-300'
          : 'p-3.5 shadow-xs hover:border-[#B9ED94]'
      }`}
    >
      <div>
        {/* Header mit Index, Titel, Ampel-Badge und Ausklapp-Trigger */}
        <div
          className={`flex items-center justify-between gap-2.5 ${
            isExpanded ? 'border-border border-b pb-2' : ''
          }`}
        >
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 select-none"
          >
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center rounded p-0.5 transition-colors"
              title={isExpanded ? 'Einklappen' : 'Ausklappen'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>

            <span className="bg-muted text-muted-foreground flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded text-[10px] font-bold">
              {index}
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-base font-semibold">{title}</h3>
              {isExpanded && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-tight break-words">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={status} size="sm" />
            {onStatusOverride && isExpanded && (
              <button
                type="button"
                onClick={() => {
                  setTargetStatus(status);
                  setIsEditingNote(!isEditingNote);
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded p-1 transition-colors"
                title="Status oder Notiz manuell ändern"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Fachlicher Hauptinhalt nur wenn ausgeklappt */}
        {isExpanded && (
          <>
            <div className="text-foreground py-2 text-xs">{children}</div>

            {/* Hinweisbox bei Unklarheiten / Veraltungen / Lücken */}
            {note && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <div className="space-y-0.5">
                  <span className="block font-semibold text-slate-900">Hinweis zur Prüfung:</span>
                  <span className="leading-relaxed">{note}</span>
                </div>
              </div>
            )}

            {/* Notarielle Handlungsanweisung */}
            {actionRequired && (
              <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-950">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <div className="space-y-0.5">
                  <span className="block font-semibold text-emerald-900">Handlungsempfehlung:</span>
                  <span className="leading-relaxed font-medium">{actionRequired}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Status-Änderung & Sachbearbeiter-Notiz */}
        {isEditingNote && (
          <div className="mt-2.5 space-y-2 rounded-lg border border-[#B9ED94] bg-[#E7F9DA]/30 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-1.5 font-medium text-[#284E0D]">
              <div className="flex items-center gap-1.5">
                <CheckCheck className="h-3.5 w-3.5 text-[#4D9619]" />
                <span className="font-semibold">Status manuell anpassen</span>
              </div>
            </div>

            {/* Status-Auswahl */}
            <div>
              <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                Neuer Status:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTargetStatus('VERIFIED')}
                  className={`cursor-pointer rounded-md border px-1.5 py-1 text-center text-[11px] font-semibold transition-colors ${
                    targetStatus === 'VERIFIED'
                      ? 'border-[#B9ED94] bg-[#E7F9DA] text-[#284E0D] ring-1 ring-[#356611]'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Belegt
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('NEEDS_REVIEW')}
                  className={`cursor-pointer rounded-md border px-1.5 py-1 text-center text-[11px] font-semibold transition-colors ${
                    targetStatus === 'NEEDS_REVIEW'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-600'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Prüfung nötig
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('OUTDATED')}
                  className={`cursor-pointer rounded-md border px-1.5 py-1 text-center text-[11px] font-semibold transition-colors ${
                    targetStatus === 'OUTDATED'
                      ? 'border-orange-300 bg-orange-50 text-orange-950 ring-1 ring-orange-600'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Veraltet
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('MISSING')}
                  className={`cursor-pointer rounded-md border px-1.5 py-1 text-center text-[11px] font-medium transition-colors ${
                    targetStatus === 'MISSING'
                      ? 'border-slate-300 bg-slate-200 text-slate-800 ring-1 ring-slate-500'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Fehlt
                </button>
              </div>
            </div>

            <div>
              <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                Optionale Notiz / Begründung:
              </label>
              <input
                type="text"
                placeholder="z.B. Telefonisch geklärt, Nachweis liegt vor..."
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border p-1.5 text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingNote(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded px-2.5 py-1 text-[11px]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => handleSaveStatus()}
                className="cursor-pointer rounded-md bg-[#A2E771] px-3 py-1 text-[11px] font-semibold text-[#284E0D] shadow-xs hover:bg-[#83DF41]"
              >
                Status speichern
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ausklappbarer Quellennachweis (Audit Trail) nur wenn Box ausgeklappt */}
      {isExpanded && <SourceAuditDrawer source={source} />}
    </div>
  );
};
