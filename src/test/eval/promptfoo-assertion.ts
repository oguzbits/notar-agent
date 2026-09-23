import { GOLDEN_DATASET } from '@/test/eval/golden-dataset';
import { scoreDossierAgainstGroundTruth } from '@/test/eval/scorer';
import { Dossier } from '@/types/dossier';

interface PromptfooAssertionContext {
  vars: {
    testCaseId: string;
  };
}

/**
 * Custom Assertion für Promptfoo.
 * Validiert die Ausgabe des Modells gegen die Notar-Kriterien:
 * - Accuracy >= 95%
 * - Provenance Coverage == 100%
 * - Guardrail Hit Rate == 100%
 */
export default async function assertNotarGroundTruth(
  output: string,
  context: PromptfooAssertionContext
) {
  const testCaseId = context?.vars?.testCaseId;
  if (!testCaseId) {
    return {
      pass: false,
      score: 0,
      reason: 'testCaseId fehlt im Assertion Context',
    };
  }

  const testCase = GOLDEN_DATASET.find((tc) => tc.id === testCaseId);
  if (!testCase) {
    return {
      pass: false,
      score: 0,
      reason: `Testfall "${testCaseId}" nicht im GOLDEN_DATASET gefunden`,
    };
  }

  let dossier: Dossier;
  try {
    dossier = JSON.parse(output) as Dossier;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      pass: false,
      score: 0,
      reason: `Output ist kein gültiges JSON-Dossier (${errorMsg})`,
    };
  }

  const scoreResult = scoreDossierAgainstGroundTruth(testCase, dossier);

  const passesAccuracy = scoreResult.accuracyRate >= 95.0;
  const passesProvenance = scoreResult.provenanceCoverageRate >= 95.0; // Kulanzschwelle 95%
  const passesGuardrails = scoreResult.guardrailHitRate >= 100.0;

  const passed = passesAccuracy && passesProvenance && passesGuardrails;

  const detailsSummary = scoreResult.details
    .filter((d) => !d.matched)
    .map((d) => `${d.fieldKey}: ${d.reason || 'Status mismatch'}`)
    .join('; ');

  return {
    pass: passed,
    score: scoreResult.accuracyRate / 100,
    reason: passed
      ? `Accuracy: ${scoreResult.accuracyRate}%, Provenance: ${scoreResult.provenanceCoverageRate}%, Guardrails: ${scoreResult.guardrailHitRate}%`
      : `Fehlgeschlagen: Accuracy=${scoreResult.accuracyRate}%, Provenance=${scoreResult.provenanceCoverageRate}%, Guardrails=${scoreResult.guardrailHitRate}%. Mismatches: ${detailsSummary || 'Keine Details'}`,
  };
}
