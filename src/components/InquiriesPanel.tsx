import { MailQuestion, Copy, Check, ArrowUpRight, CheckCircle, Circle } from 'lucide-react';
import React, { useState } from 'react';
import { Inquiry } from '@/types/dossier';

interface InquiriesPanelProps {
  inquiries: Inquiry[];
  onToggleResolve?: (inquiryId: string) => void;
}

export const InquiriesPanel: React.FC<InquiriesPanelProps> = ({ inquiries, onToggleResolve }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  if (!inquiries || inquiries.length === 0) {
    return null;
  }

  const unresolvedCount = inquiries.filter((i) => !i.resolved).length;

  const handleCopySingle = (inquiry: Inquiry) => {
    const text = `Betreff: ${inquiry.subject}\nAn: ${inquiry.recipient}\nPriorität: ${inquiry.priority}\n\n${inquiry.message}\n\nBegründung: ${inquiry.justification}`;
    navigator.clipboard.writeText(text);
    setCopiedId(inquiry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = inquiries
      .filter((inq) => !inq.resolved)
      .map(
        (inq, idx) =>
          `[Nachforderung #${idx + 1} - ${inq.recipient} | ${inq.priority}]\nBetreff: ${inq.subject}\n\n${inq.message}\n(Rechtlicher Grund: ${inq.justification})\n----------------------------------------`
      )
      .join('\n\n');

    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const getPriorityBadge = (prio: Inquiry['priority']) => {
    switch (prio) {
      case 'CRITICAL':
        return (
          <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
            Kritisch
          </span>
        );
      case 'HIGH':
        return (
          <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
            Hohe Priorität
          </span>
        );
      case 'MEDIUM':
      default:
        return (
          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 uppercase">
            Mittlere Priorität
          </span>
        );
    }
  };

  return (
    <div className="bg-card text-card-foreground border-border rounded-xl border p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-left transition-colors"
        >
          <div className="rounded-md bg-[#E7F9DA] p-1.5 text-[#284E0D]">
            <MailQuestion className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
              Erforderliche Nachforderungen &amp; Unterlagen
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
                {unresolvedCount} offen / {inquiries.length} gesamt
              </span>
            </h3>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAll}
            className="border-border bg-background hover:bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-base font-semibold shadow-xs transition-colors"
          >
            {copiedAll ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span>Kopiert</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Alle offenen kopieren</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <span className="text-xs font-medium">{isOpen ? 'Einklappen' : 'Ausklappen'}</span>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-border mt-3 space-y-2.5 border-t pt-3">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className={`rounded-lg border p-4 transition-all ${
                inquiry.resolved
                  ? 'border-border/60 bg-muted/20 opacity-60'
                  : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Checkbox zum Abhaken */}
                  {onToggleResolve && (
                    <button
                      type="button"
                      onClick={() => onToggleResolve(inquiry.id)}
                      className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
                      title={inquiry.resolved ? 'Wieder öffnen' : 'Als erledigt markieren'}
                    >
                      {inquiry.resolved ? (
                        <CheckCircle className="h-4 w-4 text-[#4D9619]" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <span className="bg-background border-border text-foreground rounded-md border px-2 py-0.5 text-xs font-semibold">
                    An: {inquiry.recipient}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Feld: <code className="text-foreground">{inquiry.fieldKey}</code>
                  </span>
                  {inquiry.resolved && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                      Erledigt / Abgehakt
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(inquiry.priority)}
                  <button
                    type="button"
                    onClick={() => handleCopySingle(inquiry)}
                    title="Nachforderungstext kopieren"
                    className="border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-md border p-1.5 transition-colors"
                  >
                    {copiedId === inquiry.id ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <h4
                className={`text-foreground mb-1.5 text-base font-semibold ${
                  inquiry.resolved ? 'text-muted-foreground line-through' : ''
                }`}
              >
                {inquiry.subject}
              </h4>

              <div className="bg-background border-border text-foreground rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                {inquiry.message}
              </div>

              <div className="text-muted-foreground mt-2 flex items-start gap-1.5 text-[11px]">
                <ArrowUpRight className="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  <strong className="text-foreground">Begründung:</strong> {inquiry.justification}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
