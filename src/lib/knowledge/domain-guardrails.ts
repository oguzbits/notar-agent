import { FIELD_STATUS, GenericFieldDossier } from '@/types/dossier';
import {
  ARITHMETIC_GUARDRAIL_RULES,
  ENERGY_CERTIFICATE_EXPIRY_GUARD,
  PARCEL_AREA_ARITHMETIC_GUARD,
  PURCHASE_PRICE_AMENDMENT_GUARD,
  RENT_AMOUNT_ARITHMETIC_GUARD,
  parseGermanOrIsoDate,
} from './rules/arithmetic-guardrails';
import {
  DomainGuardrailsOptions,
  GuardrailContext,
  GuardrailRule,
  flagField,
  hasSignificantValue,
} from './rules/guardrail-types';
import {
  BUYER_REGISTER_PROOF_GUARD,
  PARTY_GUARDRAIL_RULES,
  SELLER_OWNER_MATCH_GUARD,
  isCorporateEntity,
} from './rules/party-guardrails';

export type { DomainGuardrailsOptions, GuardrailContext, GuardrailRule };
export {
  flagField,
  hasSignificantValue,
  parseGermanOrIsoDate,
  isCorporateEntity,
  SELLER_OWNER_MATCH_GUARD,
  BUYER_REGISTER_PROOF_GUARD,
  PARTY_GUARDRAIL_RULES,
  ENERGY_CERTIFICATE_EXPIRY_GUARD,
  PARCEL_AREA_ARITHMETIC_GUARD,
  RENT_AMOUNT_ARITHMETIC_GUARD,
  PURCHASE_PRICE_AMENDMENT_GUARD,
  ARITHMETIC_GUARDRAIL_RULES,
};

/**
 * 1. Generische Konsistenz: Verifiziertes Feld darf nicht leer sein
 */
export const GENERIC_EMPTY_DATA_GUARD: GuardrailRule = {
  id: 'GENERIC_EMPTY_DATA_GUARD',
  name: 'Prüfung auf leere Werte bei verifizierten Feldern',
  evaluate({ fields }) {
    for (const field of Object.values(fields)) {
      if (!field || field.status !== FIELD_STATUS.VERIFIED) continue;
      const d = field.data;
      const hasValues = d && typeof d === 'object' && Object.values(d).some(hasSignificantValue);
      if (!hasValues) {
        flagField(
          field,
          FIELD_STATUS.NEEDS_REVIEW,
          'Angaben unvollständig – Datenwert zur Beurkundung erforderlich.'
        );
      }
    }
  },
};

/**
 * Deklarative Guardrail-Regeln (Separation of Policy and Mechanism gem. AGENTS.md)
 * Assembliert generische, beteiligten- und arithmetische Prüfregeln.
 */
export const NOTARY_GUARDRAIL_RULES: readonly GuardrailRule[] = [
  GENERIC_EMPTY_DATA_GUARD,
  ...PARTY_GUARDRAIL_RULES,
  ...ARITHMETIC_GUARDRAIL_RULES,
] as const;

/**
 * Notarielle Sachverhalts- und Plausibilitätsprüfungen (Knowledge / Policy Layer)
 * Führt die deklarativen Regeln sequenziell aus.
 */
export function applyNotaryDomainGuardrails(
  fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>> | undefined>,
  options?: DomainGuardrailsOptions
): void {
  const referenceDate = options?.referenceDate ?? new Date();
  const context: GuardrailContext = {
    fields: fieldsObj,
    referenceDate,
    referenceDateIso: referenceDate.toISOString().slice(0, 10),
  };

  for (const rule of NOTARY_GUARDRAIL_RULES) {
    rule.evaluate(context);
  }
}
