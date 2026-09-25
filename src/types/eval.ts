import { z } from 'zod';
import { FieldStatusSchema } from './dossier';

/**
 * Status eines Judge-Urteils (Deterministisch, LLM oder Jev System-1).
 */
export const JUDGE_VERDICT_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
} as const;

export const JudgeVerdictStatusSchema = z.enum([
  JUDGE_VERDICT_STATUS.PASS,
  JUDGE_VERDICT_STATUS.FAIL,
  JUDGE_VERDICT_STATUS.NEEDS_REVIEW,
]);
export type JudgeVerdictStatus = (typeof JUDGE_VERDICT_STATUS)[keyof typeof JUDGE_VERDICT_STATUS];

/**
 * Zod-Schema für das Urteil eines Evaluators/Judges.
 * Kompatibel mit TypeSafe AI Jev (Choice, Score, Confidence, Noul)
 * sowie klassischen LLM-as-a-Judge- und deterministischen Heuristiken.
 */
export const JudgeVerdictSchema = z.object({
  status: JudgeVerdictStatusSchema,
  score: z.number().min(0).max(1.0).describe('Normalisierter Score zwischen 0.0 und 1.0'),
  matched: z.boolean().describe('Ob der Vergleich die Akzeptanzkriterien erfüllt hat'),
  confidence: z.number().min(0).max(1.0).default(1.0).describe('Konfidenzwert des Urteils'),
  reason: z
    .string()
    .describe('Prägnante juristische Begründung der Übereinstimmung oder Abweichung'),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

/**
 * Layer 2: Trajectory Eval Result (RAG & Knowledge Selection Path).
 * Misst, ob der Agent den korrekten Denk- und Prüfpfad eingeschlagen hat.
 */
export const TrajectoryEvalResultSchema = z.object({
  caseId: z.string(),
  expectedKnowledgeCodes: z.array(z.string()).default([]),
  selectedKnowledgeCodes: z.array(z.string()).default([]),
  precision: z.number().min(0).max(1.0),
  recall: z.number().min(0).max(1.0),
  f1Score: z.number().min(0).max(1.0),
  stepSequenceValid: z.boolean().default(true),
  passed: z.boolean(),
  notes: z.string().optional(),
});
export type TrajectoryEvalResult = z.infer<typeof TrajectoryEvalResultSchema>;

/**
 * Layer 3: Outcome Eval Result für ein einzelnes Dossier-Feld.
 */
export const FieldOutcomeVerdictSchema = z.object({
  fieldKey: z.string(),
  expectedStatus: z.union([FieldStatusSchema, z.array(FieldStatusSchema)]),
  actualStatus: FieldStatusSchema.optional(),
  verdict: JudgeVerdictSchema,
  hasProvenance: z.boolean(),
});
export type FieldOutcomeVerdict = z.infer<typeof FieldOutcomeVerdictSchema>;

/**
 * Layer 3: Zusammenfassendes Outcome Eval Result für einen Fall.
 */
export const OutcomeEvalResultSchema = z.object({
  caseId: z.string(),
  accuracyRate: z.number().min(0).max(100.0),
  provenanceCoverageRate: z.number().min(0).max(100.0),
  guardrailHitRate: z.number().min(0).max(100.0),
  fieldVerdicts: z.array(FieldOutcomeVerdictSchema),
  passed: z.boolean(),
});
export type OutcomeEvalResult = z.infer<typeof OutcomeEvalResultSchema>;

/**
 * Layer 4: Telemetrie & Verbrauchsmetriken.
 */
export const TelemetryMetricsSchema = z.object({
  totalPromptTokens: z.number().int().nonnegative(),
  totalCompletionTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
});
export type TelemetryMetrics = z.infer<typeof TelemetryMetricsSchema>;

/**
 * Gesamter 4-Layer-Suite-Report über alle Testfälle hinweg.
 */
export const LayerEvalSuiteReportSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  layer1ComponentPassed: z.boolean(),
  layer2TrajectoryScore: z.number().min(0).max(1.0),
  layer3OutcomeAccuracy: z.number().min(0).max(100.0),
  layer4Telemetry: TelemetryMetricsSchema,
  casesTested: z.number().int().positive(),
  passed: z.boolean(),
});
export type LayerEvalSuiteReport = z.infer<typeof LayerEvalSuiteReportSchema>;
