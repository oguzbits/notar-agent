'use client';

import {
  FileText,
  Clock,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { FIELD_STATUS } from '@/types/dossier';
import { LayerEvalSuiteReport, CaseTraceArtifact, WORKFLOW_STEP_STATUS } from '@/types/eval';

export default function EvalDashboardPage() {
  const [report, setReport] = useState<LayerEvalSuiteReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCaseIdx, setActiveCaseIdx] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [activeTab, setActiveTab] = useState<'verdicts' | 'trace'>('verdicts');
  const [showOverlays, setShowOverlays] = useState(true);
  const [filterRelevantOnly, setFilterRelevantOnly] = useState(true);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [openStages, setOpenStages] = useState<Record<number, boolean>>({});

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/eval/report');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: LayerEvalSuiteReport = await res.json();
      setReport(data);
      setActiveCaseIdx(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden des Berichts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetch('/api/eval/report')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: LayerEvalSuiteReport) => {
        if (isMounted) {
          setReport(data);
          setActiveCaseIdx(0);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Fehler beim Laden des Berichts.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="text-primary h-6 w-6 animate-spin" />
          <p className="text-muted-foreground text-base">Lade Evaluierungsbericht...</p>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md p-6 text-center">
          <AlertTriangle className="text-warning mx-auto mb-3 h-8 w-8" />
          <h1 className="text-xl font-bold tracking-tight">Kein Bericht verfügbar</h1>
          <p className="text-muted-foreground mt-2 text-base">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={fetchReport}>Erneut versuchen</Button>
          </div>
        </Card>
      </main>
    );
  }

  const activeCase: CaseTraceArtifact | undefined = report.caseTraces[activeCaseIdx];

  const toggleStage = (stepNum: number) => {
    setOpenStages((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  return (
    <main className="bg-muted/40 text-foreground min-h-screen p-6">
      {/* Top Telemetry Header */}
      <header className="border-border mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 items-center justify-center rounded-lg border shadow-xs transition"
            title="Zurück zum Arbeitsplatz"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="border-border bg-card text-foreground flex h-10 w-10 items-center justify-center rounded-lg border shadow-xs">
            <Sparkles className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Multi-Stage Pipeline Evaluation</h1>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  report.passed
                    ? 'border-border bg-card text-foreground border'
                    : 'border-destructive/30 bg-destructive/10 text-destructive border'
                )}
              >
                {report.passed ? '✓ PASSED' : '✕ ISSUES DETECTED'}
              </span>
              <span className="border-border bg-card text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium">
                {report.executionMode || 'MOCK'}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              {new Date(report.timestamp).toLocaleString('de-DE')} • {report.casesTested} Testfälle
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div
            className="border-border bg-card flex items-center gap-1.5 rounded-md border px-3 py-1.5 shadow-xs"
            title="Gesamtlatenz des Durchlaufs"
          >
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground font-semibold">
              {(report.layer4Telemetry.latencyMs / 1000).toLocaleString('de-DE', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              })}{' '}
              s
            </span>
          </div>
          <div
            className="border-border bg-card flex items-center gap-2 rounded-md border px-3 py-1.5 shadow-xs"
            title="Token-Aufschlüsselung"
          >
            <Layers className="text-muted-foreground h-4 w-4" />
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-semibold">
                {(
                  report.layer4Telemetry.totalPromptTokens +
                  report.layer4Telemetry.totalCompletionTokens
                ).toLocaleString('de-DE')}{' '}
                Tokens
              </span>
              <span className="text-muted-foreground text-xs">
                ({report.layer4Telemetry.totalPromptTokens.toLocaleString('de-DE')} In /{' '}
                {report.layer4Telemetry.totalCompletionTokens.toLocaleString('de-DE')} Out)
              </span>
            </div>
          </div>
          <div className="border-border bg-card flex items-center gap-1.5 rounded-md border px-3 py-1.5 shadow-xs">
            <span className="text-foreground font-semibold">
              ${report.layer4Telemetry.totalCostUsd.toFixed(4)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReport}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Aktualisieren
          </Button>
        </div>
      </header>

      {/* Case Selector Tabs */}
      <section className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Testfälle">
        {report.caseTraces.map((tc, idx) => {
          const isActive = idx === activeCaseIdx;
          return (
            <button
              key={tc.caseId}
              onClick={() => {
                setActiveCaseIdx(idx);
                setActivePage(1);
              }}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-base font-medium shadow-xs transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background font-semibold'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground'
              )}
            >
              <span>{tc.passed ? '✓' : '⚠️'}</span>
              <span>{tc.caseName}</span>
            </button>
          );
        })}
      </section>

      {/* Main Grid: Left Document / Right Details */}
      {activeCase && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Visual Document Inspection (Enlarged to 7 cols for high readability) */}
          <section className="flex flex-col gap-4 lg:col-span-7">
            <Card className="flex flex-col p-4">
              <div className="border-border mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="text-muted-foreground h-5 w-5" />
                  <span className="text-base font-semibold">Dokumentenvorschau (Großansicht)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={filterRelevantOnly ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRelevantOnly(!filterRelevantOnly)}
                    title="Zwischen nur extrahierten Feldern und allen OCR-Layout-Blöcken umschalten"
                  >
                    {filterRelevantOnly ? '🎯 Nur extrahierte Felder' : '📑 Alle Layout-Blöcke'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOverlays(!showOverlays)}
                  >
                    {showOverlays ? (
                      <>
                        <EyeOff className="mr-1.5 h-4 w-4" /> Ausblenden
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1.5 h-4 w-4" /> Einblenden
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Render Image with Bounding Box Overlays or Placeholder */}
              {(() => {
                const parseStep = activeCase.steps.find((s) => s.stepNumber === 1);
                const step3 = activeCase.steps.find((s) => s.stepNumber === 3);
                const step3Fields =
                  (
                    step3?.artifacts?.rawJson as {
                      fields?: Record<
                        string,
                        { data?: Record<string, unknown>; source?: { snippet?: string } }
                      >;
                    }
                  )?.fields || {};

                const screenshots =
                  (parseStep?.artifacts?.pageScreenshots as
                    | Array<{
                        pageNum: number;
                        width: number;
                        height: number;
                        base64Png: string;
                      }>
                    | undefined) || [];

                const blocks =
                  (parseStep?.artifacts?.blocks as
                    | Array<{
                        pageNumber: number;
                        type?: string;
                        content?: string;
                        bbox?: {
                          x: number;
                          y: number;
                          width: number;
                          height: number;
                        };
                      }>
                    | undefined) || [];

                const currentScreenshot =
                  screenshots.find((s) => s.pageNum === activePage) || screenshots[0];

                if (!currentScreenshot?.base64Png) {
                  return (
                    <div className="border-border bg-muted/40 text-muted-foreground flex min-h-96 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm">
                      <FileText className="text-muted-foreground mb-2 h-10 w-10" />
                      <p className="font-medium">Kein Seiten-Rendering in diesem Trace</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {activeCase.parserResult
                          ? `${activeCase.parserResult.fileName} (${activeCase.parserResult.matchedTokensCount} Tokens erfasst)`
                          : 'Keine Layout-Daten vorhanden'}
                      </p>
                    </div>
                  );
                }

                // Standard PDF points: 144 DPI renders 595.28 x 841.89 pt as 1190 x 1684 px (factor ~2.0)
                const pageWidthPt = currentScreenshot.width / 2;
                const pageHeightPt = currentScreenshot.height / 2;

                const allPageBlocks = blocks.filter(
                  (b) => b.pageNumber === currentScreenshot.pageNum && b.bbox
                );

                // Identify blocks that correspond to extracted fields or critical values
                const enrichedBlocks = allPageBlocks.map((block) => {
                  const content = block.content || '';
                  let associatedField: string | null = null;
                  let extractedLabel: string | null = null;

                  // Check if block matches any extracted field from Step 3
                  for (const [fKey, fVal] of Object.entries(step3Fields)) {
                    const snippet = fVal.source?.snippet || '';
                    if (snippet && content.includes(snippet.replace(/Gültig bis:\s*/, '').trim())) {
                      associatedField = fKey;
                      extractedLabel = `${fKey}: ${snippet}`;
                      break;
                    }
                    if (fKey === 'energieausweis') {
                      if (content.includes('10.02.2023') || content.includes('Gültig bis')) {
                        associatedField = 'energieausweis';
                        extractedLabel = 'Gültig bis: 10.02.2023 (Frist)';
                      } else if (
                        content.includes('182,0') ||
                        content.includes('Endenergiebedarf')
                      ) {
                        associatedField = 'energieausweis';
                        extractedLabel = 'Endenergiebedarf: 182,0 kWh/(m²·a)';
                      }
                    }
                  }

                  // Also check critical case tokens like addresses or case titles
                  if (
                    !associatedField &&
                    (content.includes('Aachener Str') || content.includes('NW-2013-000192841'))
                  ) {
                    associatedField = 'objekt';
                    extractedLabel = content;
                  }

                  return {
                    ...block,
                    isRelevant: !!associatedField,
                    associatedField,
                    extractedLabel,
                  };
                });

                const displayBlocks = filterRelevantOnly
                  ? enrichedBlocks.filter((b) => b.isRelevant)
                  : enrichedBlocks;

                return (
                  <div className="flex flex-col gap-3">
                    {/* Multi-page controls if multiple pages available */}
                    {screenshots.length > 1 && (
                      <div className="border-border bg-card text-muted-foreground flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={activePage <= 1}
                          onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" /> Vorherige
                        </Button>
                        <span className="text-foreground font-semibold">
                          Seite {currentScreenshot.pageNum} von {screenshots.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={activePage >= screenshots.length}
                          onClick={() => setActivePage((p) => Math.min(screenshots.length, p + 1))}
                        >
                          Nächste <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Document Page & Bounding Box Canvas */}
                    <div className="border-border bg-card relative overflow-hidden rounded-lg border p-2 shadow-xs select-none">
                      <div className="border-border/80 relative overflow-hidden rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentScreenshot.base64Png}
                          alt={`Seite ${currentScreenshot.pageNum}`}
                          className="block h-auto w-full select-none"
                        />

                        {/* Bounding Box Overlays */}
                        {showOverlays && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            aria-label="Bounding Box Overlays"
                          >
                            {displayBlocks.map((block, bIdx) => {
                              if (!block.bbox) return null;
                              const leftPct = (block.bbox.x / pageWidthPt) * 100;
                              const topPct = (block.bbox.y / pageHeightPt) * 100;
                              const widthPct = (block.bbox.width / pageWidthPt) * 100;
                              const heightPct = (block.bbox.height / pageHeightPt) * 100;

                              const isHovered =
                                hoveredField && block.associatedField === hoveredField;

                              return (
                                <div
                                  key={bIdx}
                                  className={cn(
                                    'group pointer-events-auto absolute cursor-pointer rounded-xs transition-all',
                                    block.isRelevant
                                      ? 'border-primary bg-primary/20 hover:bg-primary/35 border-2 shadow-sm'
                                      : 'border-google-blue/60 bg-google-blue/10 hover:bg-google-blue/25 border',
                                    isHovered &&
                                      'ring-primary border-primary bg-primary/40 z-20 ring-4'
                                  )}
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${widthPct}%`,
                                    height: `${heightPct}%`,
                                  }}
                                  onMouseEnter={() =>
                                    block.associatedField && setHoveredField(block.associatedField)
                                  }
                                  onMouseLeave={() => setHoveredField(null)}
                                  title={
                                    block.extractedLabel || block.content || `Block ${bIdx + 1}`
                                  }
                                >
                                  {/* Badge label for extracted relevant fields */}
                                  {block.isRelevant && block.extractedLabel && (
                                    <div className="bg-foreground text-background absolute -top-6 left-0 z-30 rounded px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-md">
                                      {block.extractedLabel}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-muted-foreground flex items-center justify-between px-1 text-sm">
                      <span>
                        {displayBlocks.length}{' '}
                        {filterRelevantOnly ? 'extrahierte Zielfelder' : 'Layout-Blöcke'} auf Seite{' '}
                        {currentScreenshot.pageNum}
                        {filterRelevantOnly &&
                          ` (${allPageBlocks.length - displayBlocks.length} Hintergrundblöcke gefiltert)`}
                      </span>
                      <span>
                        Auflösung: {currentScreenshot.width} × {currentScreenshot.height} px
                      </span>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </section>

          {/* Right Column: Interactive Details Tabs */}
          <section className="flex flex-col gap-4 lg:col-span-5">
            <Card className="flex flex-col p-4">
              <div className="border-border mb-4 flex items-center justify-between border-b pb-3">
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === 'verdicts' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('verdicts')}
                  >
                    ⚖️ Soll-Ist-Abgleich
                  </Button>
                  <Button
                    variant={activeTab === 'trace' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('trace')}
                  >
                    🔄 Workflow-Trace (Stufen 1–5)
                  </Button>
                </div>
                <span className="text-foreground text-sm font-semibold">
                  {activeCase.outcomeResult
                    ? `Genauigkeit: ${activeCase.outcomeResult.accuracyRate}%`
                    : ''}
                </span>
              </div>

              {/* Tab 1: Verdicts Table */}
              {activeTab === 'verdicts' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-base">
                    <thead className="border-border text-muted-foreground border-b text-xs font-semibold uppercase">
                      <tr>
                        <th className="py-3 pr-3">Feld</th>
                        <th className="px-3 py-3">Soll</th>
                        <th className="px-3 py-3">Ist</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="py-3 pl-3">Begründung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {activeCase.outcomeResult?.fieldVerdicts.map((v) => {
                        const isReviewOrOutdated =
                          v.actualStatus === FIELD_STATUS.NEEDS_REVIEW ||
                          v.actualStatus === FIELD_STATUS.OUTDATED;
                        const isHovered = hoveredField === v.fieldKey;

                        return (
                          <tr
                            key={v.fieldKey}
                            onMouseEnter={() => setHoveredField(v.fieldKey)}
                            onMouseLeave={() => setHoveredField(null)}
                            className={cn(
                              'cursor-pointer transition-colors',
                              isHovered ? 'bg-primary/10' : 'hover:bg-muted/30'
                            )}
                          >
                            <td className="text-foreground py-3.5 pr-3 font-semibold">
                              <div className="flex items-center gap-1.5">
                                <span>{v.fieldKey}</span>
                                {isHovered && (
                                  <span className="text-primary text-xs font-normal">
                                    (in PDF fokussiert)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-muted-foreground px-3 py-3.5 text-sm">
                              {Array.isArray(v.expectedStatus)
                                ? v.expectedStatus.join(' | ')
                                : v.expectedStatus}
                            </td>
                            <td className="text-foreground px-3 py-3.5 text-sm font-medium">
                              {v.actualStatus || '-'}
                            </td>
                            <td className="px-3 py-3.5">
                              {v.actualStatus ? (
                                <StatusBadge status={v.actualStatus} size="sm" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3.5 pl-3">
                              {isReviewOrOutdated && v.verdict?.reason ? (
                                <div className="border-warning bg-warning/10 text-foreground rounded border-l-2 p-2.5 text-sm leading-relaxed">
                                  {v.verdict.reason}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm leading-relaxed">
                                  {v.verdict?.reason || '-'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Workflow Steps Accordion */}
              {activeTab === 'trace' && (
                <div className="flex flex-col gap-3">
                  {activeCase.steps.map((st) => {
                    const isOpen = openStages[st.stepNumber] ?? false;
                    return (
                      <div
                        key={st.stepNumber}
                        className="border-border bg-card overflow-hidden rounded-lg border shadow-xs"
                      >
                        <button
                          onClick={() => toggleStage(st.stepNumber)}
                          className="hover:bg-muted/40 flex w-full items-center justify-between p-4 text-left transition"
                        >
                          <div className="flex items-center gap-2.5">
                            {isOpen ? (
                              <ChevronDown className="text-muted-foreground h-5 w-5" />
                            ) : (
                              <ChevronRight className="text-muted-foreground h-5 w-5" />
                            )}
                            <span className="text-foreground text-base font-semibold">
                              Stufe {st.stepNumber}: {st.stepName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-sm font-medium">
                              {st.durationMs} ms
                            </span>
                            <span
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs font-semibold',
                                st.status === WORKFLOW_STEP_STATUS.SUCCESS
                                  ? 'border-border bg-muted text-foreground'
                                  : 'border-destructive/30 bg-destructive/10 text-destructive'
                              )}
                            >
                              {st.status}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-border bg-muted/20 space-y-2 border-t p-4 text-sm leading-relaxed">
                            <div>
                              <span className="text-foreground font-semibold">Input: </span>
                              <span className="text-muted-foreground">{st.inputSummary}</span>
                            </div>
                            <div>
                              <span className="text-foreground font-semibold">Output: </span>
                              <span className="text-muted-foreground">{st.outputSummary}</span>
                            </div>
                            {st.artifacts && Object.keys(st.artifacts).length > 0 && (
                              <details className="mt-3">
                                <summary className="text-foreground cursor-pointer font-medium hover:underline">
                                  Artefakte anzeigen ({Object.keys(st.artifacts).length})
                                </summary>
                                <pre className="bg-card border-border text-foreground mt-2 max-h-60 overflow-auto rounded border p-3 font-mono text-xs">
                                  {JSON.stringify(st.artifacts, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}
