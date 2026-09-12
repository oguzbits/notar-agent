import React from 'react';
import { FileSearch, Scale, CheckCircle2 } from 'lucide-react';

interface AgenticWorkflowStepperProps {
  isAnalyzing: boolean;
  activeStep?: 1 | 2 | 3;
  stepDetail?: string;
}

export const AgenticWorkflowStepper: React.FC<AgenticWorkflowStepperProps> = ({
  isAnalyzing,
  activeStep = 1,
}) => {
  if (!isAnalyzing) return null;

  const currentStep = activeStep;

  const steps = [
    {
      id: 1,
      name: 'Stufe 1: Urkunden- & Sachverhaltserfassung',
      desc: 'Erfassung & Belegnachweis aus Dokumenten, Plänen und Notizen',
      icon: FileSearch,
    },
    {
      id: 2,
      name: 'Stufe 2: Notarielle Vorprüfung & Plausibilisierung',
      desc: 'Prüfung von Fristen (§ 80 GEG), Berechtigungen & Widersprüchen',
      icon: Scale,
    },
    {
      id: 3,
      name: 'Stufe 3: Prüfbericht & Vorgangsabgleich',
      desc: 'Konsistenzabgleich, Belegprüfung & Cockpit-Aufbereitung',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="bg-card border-border animate-in fade-in rounded-xl border p-4 shadow-sm duration-300">
      <div className="border-border mb-3 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-foreground text-xs font-bold tracking-wider uppercase">
            Notarieller Prüfprozess aktiv
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                isActive
                  ? 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : isDone
                    ? 'border-border/60 bg-muted/30 opacity-75'
                    : 'border-border/40 bg-card/50 opacity-40'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  isActive
                    ? 'animate-pulse bg-emerald-600 text-white'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-foreground text-xs leading-snug font-semibold">{step.name}</p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
