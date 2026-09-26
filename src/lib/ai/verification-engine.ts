import { applyNotaryDomainGuardrails } from '@/lib/knowledge/domain-guardrails';
import { GenericFieldDossier } from '@/types/dossier';
import { ExtractionFieldsRecord, ExtractionStageOutput } from '@/types/pipeline';
import {
  SourceDocumentText,
  VerificationIssue,
  verifyExtractionFacts,
} from './verifiable-fact-checker';

export type { SourceDocumentText, VerificationIssue };

export interface VerificationPipelineOptions {
  stageOutput: ExtractionStageOutput;
  sourceDocuments: SourceDocumentText[];
  referenceDate?: Date;
}

export interface VerificationPipelineResult extends ExtractionStageOutput {
  verificationIssues: VerificationIssue[];
}

/**
 * Deep Module: Einheitliche Notarielle Verifikations-Engine.
 *
 * Führt alle deterministischen Prüfungen in einem einzigen konsistenten Durchlauf aus:
 * 1. Zitationsbeleg-Prüfung gegen Textlayer (Verifiable Rewards / Fact Checks)
 * 2. Arithmetische Konsistenz (Kaufpreis vs. Raten, Stammkapital vs. Gesellschafteranteile)
 * 3. Normative Plausibilitäts- und Fristen-Guardrails (Eigentümeridentität, GEG-Fristen, Parzellen)
 */
export function runNotaryVerification(
  options: VerificationPipelineOptions
): VerificationPipelineResult {
  const { stageOutput, sourceDocuments, referenceDate = new Date() } = options;

  // 1. Zitations- & Fakten-Check
  const verifiedFacts = verifyExtractionFacts({
    stageOutput,
    sourceDocuments,
  });

  const fields = verifiedFacts.fields as Record<
    string,
    GenericFieldDossier<Record<string, unknown>> | undefined
  >;

  // 2. Normative Guardrails (Deklarative Regeln)
  applyNotaryDomainGuardrails(fields, { referenceDate });

  return {
    ...verifiedFacts,
    fields: fields as ExtractionFieldsRecord,
  };
}
