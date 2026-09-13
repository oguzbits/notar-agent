import { FileSearch, Scale, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

interface AgenticWorkflowStepperProps {
  isAnalyzing: boolean;
  activeStep?: 1 | 2 | 3;
  stepDetail?: string;
}

export const AgenticWorkflowStepper: React.FC<AgenticWorkflowStepperProps> = ({
  isAnalyzing,
  activeStep = 1,
  stepDetail,
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
    <div className="bg-card border-border space-y-4 rounded-xl border p-5 shadow-xs">
      {/* Header mit Live-Status und Detail */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-notar-700 h-2.5 w-2.5 rounded-full"></span>
          <span className="text-foreground text-sm font-bold tracking-wide uppercase">
            KI-Analyse aktiv • Stufe {currentStep} von 3
          </span>
        </div>

        {stepDetail && (
          <span className="text-notar-950 bg-notar-100 border-notar-400/60 rounded-md border px-2.5 py-1 text-xs font-semibold">
            {stepDetail}
          </span>
        )}
      </div>

      {/* 3 Stufen Grid mit hohem Kontrast */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3.5 transition-all',
                isActive
                  ? 'border-notar-600 bg-notar-50 text-notar-950 ring-notar-500/40 shadow-xs ring-1'
                  : isDone
                    ? 'border-notar-400 bg-notar-200/50 text-foreground'
                    : 'border-border/60 bg-muted/20 opacity-50'
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all',
                  isActive
                    ? 'bg-notar-800 text-white shadow-xs'
                    : isDone
                      ? 'bg-notar-800 text-white'
                      : 'bg-muted text-muted-foreground border-border border'
                )}
              >
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-xs leading-snug font-bold',
                    isActive ? 'text-notar-950' : 'text-foreground'
                  )}
                >
                  {step.name}
                </p>
                <p className="text-muted-foreground text-2xs mt-0.5 leading-normal">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
