import { TrajectoryEvalResult } from '@/types/eval';

export interface ScoreTrajectoryKnowledgeSelectionParams {
  caseId: string;
  expectedKnowledgeCodes: string[];
  selectedKnowledgeCodes: string[];
  stepSequenceValid?: boolean;
}

/**
 * Bewertet den Trajectory-Schritt der Wissensselektion (RAG / Knowledge Selector):
 * - Recall: Wurden alle für den Fall erforderlichen Gesetzesnormen herangezogen?
 * - Precision: Wurden irrelevante Regeln vermieden (Sparen von Context-Tokens)?
 * - F1-Score: Harmonischer Mittelwert der Güte.
 */
export function scoreTrajectoryKnowledgeSelection(
  params: ScoreTrajectoryKnowledgeSelectionParams
): TrajectoryEvalResult {
  const {
    caseId,
    expectedKnowledgeCodes,
    selectedKnowledgeCodes,
    stepSequenceValid = true,
  } = params;

  if (expectedKnowledgeCodes.length === 0) {
    return {
      caseId,
      expectedKnowledgeCodes,
      selectedKnowledgeCodes,
      precision: 1.0,
      recall: 1.0,
      f1Score: 1.0,
      stepSequenceValid,
      passed: true,
      notes: 'Keine Pflichtnormen für diesen Fall vorgegeben.',
    };
  }

  const expectedSet = new Set(expectedKnowledgeCodes.map((c) => c.trim().toLowerCase()));
  const selectedSet = new Set(selectedKnowledgeCodes.map((c) => c.trim().toLowerCase()));

  let truePositives = 0;
  for (const expected of expectedSet) {
    if (selectedSet.has(expected)) {
      truePositives++;
    }
  }

  const recall = truePositives / expectedSet.size;
  const precision = selectedSet.size > 0 ? truePositives / selectedSet.size : 0;

  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Recall muss 100% sein, um juristische Risiken (übersehene Pflichten) auszuschließen
  const passed = recall >= 1.0 && stepSequenceValid;

  return {
    caseId,
    expectedKnowledgeCodes,
    selectedKnowledgeCodes,
    precision: Math.round(precision * 100) / 100,
    recall: Math.round(recall * 100) / 100,
    f1Score: Math.round(f1Score * 100) / 100,
    stepSequenceValid,
    passed,
    notes: !passed ? `Unvollständige Rechtsnormen-Selektion (Recall: ${recall * 100}%)` : undefined,
  };
}
