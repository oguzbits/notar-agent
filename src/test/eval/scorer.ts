import { Dossier, FieldStatus, FIELD_STATUS } from '@/types/dossier';
import { FieldOutcomeVerdict, JUDGE_VERDICT_STATUS } from '@/types/eval';
import { GoldenTestCase } from './golden-dataset';

export interface EvaluationMetricResult {
  totalFieldsTested: number;
  matchingFieldsCount: number;
  accuracyRate: number; // 0.0 - 100.0 %
  provenanceCoverageRate: number; // 0.0 - 100.0 %
  guardrailHitRate: number; // 0.0 - 100.0 %
  fieldVerdicts: FieldOutcomeVerdict[];
  details: Array<{
    caseId: string;
    fieldKey: string;
    expectedStatus: FieldStatus | FieldStatus[];
    actualStatus?: FieldStatus;
    matched: boolean;
    hasProvenance: boolean;
    reason?: string;
  }>;
}

export function scoreDossierAgainstGroundTruth(
  testCase: GoldenTestCase,
  actualDossier: Dossier
): EvaluationMetricResult {
  const details: EvaluationMetricResult['details'] = [];
  const fieldVerdicts: FieldOutcomeVerdict[] = [];

  let totalFields = 0;
  let matchingFields = 0;
  let provenanceValidFields = 0;
  let guardrailChecks = 0;
  let guardrailHits = 0;

  const actualFields = actualDossier.fields as Record<
    string,
    | {
        status?: FieldStatus;
        source?: { fileName?: string; snippet?: string };
        data?: Record<string, unknown>;
      }
    | undefined
  >;

  for (const [fieldKey, expected] of Object.entries(testCase.groundTruth.fields)) {
    totalFields++;
    const actual = actualFields[fieldKey];
    const actualStatus = actual?.status;
    const isStatusMatch = Array.isArray(expected.expectedStatus)
      ? Boolean(actualStatus && expected.expectedStatus.includes(actualStatus))
      : actualStatus === expected.expectedStatus;

    // Provenance Check: Snippet & Dateiname müssen belegt sein
    const hasProvenance = Boolean(
      actual?.source?.fileName &&
      actual.source.fileName.trim().length > 0 &&
      actual?.source?.snippet &&
      actual.source.snippet.trim().length > 0
    );

    if (hasProvenance) {
      provenanceValidFields++;
    }

    // Werte-Abgleich falls spezifiziert
    let valuesMatch = true;
    let mismatchDetail = '';

    if (expected.expectedValues && actual?.data) {
      for (const [vKey, vVal] of Object.entries(expected.expectedValues)) {
        const actualVal = actual.data[vKey];
        if (Array.isArray(vVal) && (typeof vVal[0] === 'number' || typeof vVal[0] === 'string')) {
          // Mehrere akzeptierte Werte (z.B. [94, 118.2] bei Nichtwohngebäude Wärme vs. Primärenergie)
          const isAllowed = vVal.some((candidate) => {
            if (typeof candidate === 'string' && typeof actualVal === 'string') {
              const cleanCand = candidate
                .trim()
                .toLowerCase()
                .replace(/^amtsgericht\s+/i, '');
              const cleanAct = actualVal
                .trim()
                .toLowerCase()
                .replace(/^amtsgericht\s+/i, '');
              return (
                cleanAct === cleanCand ||
                cleanAct.includes(cleanCand) ||
                cleanCand.includes(cleanAct)
              );
            }
            return candidate === actualVal;
          });
          if (!isAllowed) {
            valuesMatch = false;
            mismatchDetail = `Attribut "${vKey}": erwartet einen aus ${JSON.stringify(vVal)}, erhalten ${JSON.stringify(actualVal)}`;
            break;
          }
        } else if (typeof vVal === 'string' && typeof actualVal === 'string') {
          const cleanStr = (s: string) =>
            s
              .trim()
              .toLowerCase()
              .replace(/^(?:herr|frau)\s+/i, '');
          if (cleanStr(vVal) !== cleanStr(actualVal)) {
            valuesMatch = false;
            mismatchDetail = `Attribut "${vKey}": erwartet ${JSON.stringify(vVal)}, erhalten ${JSON.stringify(actualVal)}`;
            break;
          }
        } else if (typeof vVal === 'object' && vVal !== null) {
          if (JSON.stringify(actualVal) !== JSON.stringify(vVal)) {
            valuesMatch = false;
            mismatchDetail = `Attribut "${vKey}": erwartet ${JSON.stringify(vVal)}, erhalten ${JSON.stringify(actualVal)}`;
            break;
          }
        } else if (actualVal !== vVal) {
          valuesMatch = false;
          mismatchDetail = `Attribut "${vKey}": erwartet ${JSON.stringify(vVal)}, erhalten ${JSON.stringify(actualVal)}`;
          break;
        }
      }
    } else if (expected.expectedValues && !actual?.data) {
      valuesMatch = false;
      mismatchDetail = 'Keine Objektdaten (data) im Dossier vorhanden';
    }

    const matched = isStatusMatch && valuesMatch;
    if (matched) {
      matchingFields++;
    }

    // Spezielle Guardrail-Prüfung (z. B. OUTDATED bei abgelaufenem Energieausweis)
    if (
      expected.expectedStatus === FIELD_STATUS.OUTDATED ||
      expected.expectedStatus === FIELD_STATUS.NEEDS_REVIEW
    ) {
      guardrailChecks++;
      if (actualStatus === expected.expectedStatus) {
        guardrailHits++;
      }
    }

    let reason: string | undefined;
    if (!isStatusMatch) {
      reason = `Status-Abweichung: erwartet ${expected.expectedStatus}, erhalten ${actualStatus ?? 'fehlt'}`;
    } else if (!valuesMatch) {
      reason = `Wert-Abweichung: ${mismatchDetail}`;
    }

    details.push({
      caseId: testCase.id,
      fieldKey,
      expectedStatus: expected.expectedStatus,
      actualStatus,
      matched,
      hasProvenance,
      reason,
    });

    fieldVerdicts.push({
      fieldKey,
      expectedStatus: expected.expectedStatus,
      actualStatus,
      hasProvenance,
      verdict: {
        status: matched ? JUDGE_VERDICT_STATUS.PASS : JUDGE_VERDICT_STATUS.FAIL,
        score: matched ? 1.0 : 0.0,
        matched,
        confidence: 1.0,
        reason:
          reason ||
          (matched ? 'Erwarteter Feldstatus und Werte stimmen überein' : 'Feldabweichung'),
      },
    });
  }

  const accuracyRate = totalFields > 0 ? (matchingFields / totalFields) * 100 : 100;
  const provenanceCoverageRate =
    totalFields > 0 ? (provenanceValidFields / totalFields) * 100 : 100;
  const guardrailHitRate = guardrailChecks > 0 ? (guardrailHits / guardrailChecks) * 100 : 100;

  return {
    totalFieldsTested: totalFields,
    matchingFieldsCount: matchingFields,
    accuracyRate: Math.round(accuracyRate * 10) / 10,
    provenanceCoverageRate: Math.round(provenanceCoverageRate * 10) / 10,
    guardrailHitRate: Math.round(guardrailHitRate * 10) / 10,
    fieldVerdicts,
    details,
  };
}

/**
 * Berechnet Standard-Perzentile (P50, P90, P95, P99) aus einer Latenz-Reihe.
 */
export function calculatePercentiles(latenciesMs: number[]): {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
} {
  if (latenciesMs.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) return sorted[lower] ?? 0;
    return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
  };

  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    p50: Math.round(getPercentile(50)),
    p90: Math.round(getPercentile(90)),
    p95: Math.round(getPercentile(95)),
    p99: Math.round(getPercentile(99)),
    min: Math.round(sorted[0] ?? 0),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
    avg: Math.round(sum / sorted.length),
  };
}
