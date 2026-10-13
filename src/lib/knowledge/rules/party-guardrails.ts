import { isEntityMatch } from '@/lib/dossier/entity-reconciliation';
import { FIELD_STATUS, KaeuferDataSchema, VerkaeuferDataSchema } from '@/types/dossier';
import { flagField, GuardrailRule } from './guardrail-types';

export function isCorporateEntity(legalForm?: string): boolean {
  if (!legalForm) return false;
  const form = legalForm.toLowerCase().trim();
  return !['natürliche person', 'privatperson', 'einzelperson'].includes(form);
}

export const SELLER_OWNER_MATCH_GUARD: GuardrailRule = {
  id: 'SELLER_OWNER_MATCH_GUARD',
  name: 'Eigentümeridentität und Vertretungsnachweis des Verkäufers',
  evaluate({ fields }) {
    const field = fields['verkaeufer'];
    if (!field?.data || field.status !== FIELD_STATUS.VERIFIED) return;

    const vResult = VerkaeuferDataSchema.partial().safeParse(field.data);
    const vData = vResult.success ? vResult.data : {};

    const owners = vData.registeredOwnersGrundbuch;
    const hasOwners = Array.isArray(owners) && owners.length > 0 && Boolean(vData.name);
    const matchesOwner =
      hasOwners && owners.some((owner) => isEntityMatch(vData.name || '', owner));

    if (hasOwners && !matchesOwner && !vData.representationProofProvided) {
      flagField(
        field,
        FIELD_STATUS.NEEDS_REVIEW,
        'Eigentümer lt. Grundbuch weicht vom handelnden Verkäufer ab – Nachweis der Verfügungsbefugnis oder Erbnachweis erforderlich.'
      );
    }

    if (isCorporateEntity(vData.legalForm) && vData.representationProofProvided === false) {
      flagField(
        field,
        FIELD_STATUS.NEEDS_REVIEW,
        'Vertretungsnachweis der Gesellschaft vor Beurkundung erforderlich.'
      );
    }
  },
};

export const BUYER_REGISTER_PROOF_GUARD: GuardrailRule = {
  id: 'BUYER_REGISTER_PROOF_GUARD',
  name: 'Amtlicher Registerauszug bei Käufergesellschaften',
  evaluate({ fields }) {
    const field = fields['kaeufer'];
    if (!field?.data || field.status !== FIELD_STATUS.VERIFIED) return;

    const kResult = KaeuferDataSchema.partial().safeParse(field.data);
    const kData = kResult.success ? kResult.data : {};

    if (isCorporateEntity(kData.legalForm) && kData.hasOfficialRegisterProof === false) {
      flagField(
        field,
        FIELD_STATUS.NEEDS_REVIEW,
        'Amtlicher Registerauszug der Käufergesellschaft fehlt bisher im Aktenbestand.'
      );
    }
  },
};

export const PARTY_GUARDRAIL_RULES: readonly GuardrailRule[] = [
  SELLER_OWNER_MATCH_GUARD,
  BUYER_REGISTER_PROOF_GUARD,
] as const;
