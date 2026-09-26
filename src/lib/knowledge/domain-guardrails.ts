import { isEntityMatch } from '@/lib/dossier/entity-reconciliation';
import {
  EnergieausweisDataSchema,
  FIELD_STATUS,
  FieldStatus,
  GenericFieldDossier,
  KaeuferDataSchema,
  MietverhaeltnisseDataSchema,
  VerkaeuferDataSchema,
} from '@/types/dossier';

export interface DomainGuardrailsOptions {
  referenceDate?: Date;
}

export interface GuardrailContext {
  fields: Record<string, GenericFieldDossier<Record<string, unknown>> | undefined>;
  referenceDate: Date;
  referenceDateIso: string;
}

export interface GuardrailRule {
  id: string;
  name: string;
  evaluate(ctx: GuardrailContext): void;
}

/**
 * Hilfsfunktion zum sicheren Aktualisieren von Feld-Status und Notizen.
 */
function flagField(
  field: GenericFieldDossier<Record<string, unknown>>,
  newStatus: FieldStatus,
  noteText: string,
  append = false
): void {
  field.status = newStatus;
  if (!field.note) {
    field.note = noteText;
  } else if (append && !field.note.includes(noteText)) {
    field.note = `${field.note} (${noteText})`;
  }
}

function hasSignificantValue(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'boolean') return val;
  return true;
}

function parseGermanOrIsoDate(raw: string): string | null {
  const clean = raw.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('.');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Deklarative Guardrail-Regeln (Separation of Policy and Mechanism gem. AGENTS.md)
 * Jede Regel kapselt eine isolierte fachliche Integritätsprüfung.
 */
export const NOTARY_GUARDRAIL_RULES: readonly GuardrailRule[] = [
  // 1. Generische Konsistenz: Verifiziertes Feld darf nicht leer sein
  {
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
  },

  // 2. Eigentümeridentität & Vertretungsberechtigung
  {
    id: 'SELLER_OWNER_MATCH_GUARD',
    name: 'Eigentümeridentität und Vertretungsnachweis des Verkäufers',
    evaluate({ fields }) {
      const field = fields['verkaeufer'];
      if (!field || !field.data || field.status !== FIELD_STATUS.VERIFIED) return;

      const vResult = VerkaeuferDataSchema.partial().safeParse(field.data);
      const vData = vResult.success ? vResult.data : {};

      const owners = vData.registeredOwnersGrundbuch;
      if (Array.isArray(owners) && owners.length > 0 && vData.name) {
        const matchesOwner = owners.some((owner) => isEntityMatch(vData.name || '', owner));
        if (!matchesOwner && !vData.representationProofProvided) {
          flagField(
            field,
            FIELD_STATUS.NEEDS_REVIEW,
            'Eigentümer lt. Grundbuch weicht vom handelnden Verkäufer ab – Nachweis der Verfügungsbefugnis oder Erbnachweis erforderlich.'
          );
        }
      }

      const form = vData.legalForm?.toLowerCase().trim();
      const isCorporate =
        form && !['natürliche person', 'privatperson', 'einzelperson'].includes(form);
      if (isCorporate && vData.representationProofProvided === false) {
        flagField(
          field,
          FIELD_STATUS.NEEDS_REVIEW,
          'Vertretungsnachweis der Gesellschaft vor Beurkundung erforderlich.'
        );
      }
    },
  },

  // 3. Registerauszug bei Käufergesellschaften
  {
    id: 'BUYER_REGISTER_PROOF_GUARD',
    name: 'Amtlicher Registerauszug bei Käufergesellschaften',
    evaluate({ fields }) {
      const field = fields['kaeufer'];
      if (!field || !field.data || field.status !== FIELD_STATUS.VERIFIED) return;

      const kResult = KaeuferDataSchema.partial().safeParse(field.data);
      const kData = kResult.success ? kResult.data : {};

      const form = kData.legalForm?.toLowerCase().trim();
      const isCorporate =
        form && !['natürliche person', 'privatperson', 'einzelperson'].includes(form);
      if (isCorporate && kData.hasOfficialRegisterProof === false) {
        flagField(
          field,
          FIELD_STATUS.NEEDS_REVIEW,
          'Amtlicher Registerauszug der Käufergesellschaft fehlt bisher im Aktenbestand.'
        );
      }
    },
  },

  // 4. Fristenprüfung: Gültigkeitsdauer Energieausweis
  {
    id: 'ENERGY_CERTIFICATE_EXPIRY_GUARD',
    name: 'Gültigkeitsdauer des Energieausweises zum Stichtag',
    evaluate({ fields, referenceDateIso }) {
      const field = fields['energieausweis'];
      if (!field?.data) return;

      const eResult = EnergieausweisDataSchema.partial().safeParse(field.data);
      if (!eResult.success || !eResult.data.validUntil) return;

      const isoDate = parseGermanOrIsoDate(eResult.data.validUntil);
      if (isoDate && isoDate < referenceDateIso) {
        field.status = FIELD_STATUS.OUTDATED;
        field.data.isExpired = true;
        if (!field.note?.includes('abgelaufen')) {
          field.note = `Gültigkeitsdauer des Energieausweises zum Stichtag (${eResult.data.validUntil.trim().slice(0, 10)}) abgelaufen.`;
        }
      }
    },
  },

  // 5. Arithmetik-Guardrail: Flurstücksflächen
  {
    id: 'PARCEL_AREA_ARITHMETIC_GUARD',
    name: 'Flächenkonsistenz der Flurstücke vs. Gesamtfläche',
    evaluate({ fields }) {
      const field = fields['grundstuecke'];
      if (!field || !field.data || typeof field.data !== 'object') return;

      const rawData = field.data as Record<string, unknown>;
      const rawParcels = Array.isArray(rawData.parcels) ? rawData.parcels : [];
      if (rawParcels.length === 0) return;

      const sumParcels = rawParcels.reduce((acc: number, p: unknown) => {
        if (p && typeof p === 'object' && 'sizeM2' in p) {
          const val = Number((p as { sizeM2?: unknown }).sizeM2);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0);

      const totalArea = Number(rawData.totalAreaM2 ?? 0);
      if (totalArea > 0 && sumParcels > 0 && Math.abs(sumParcels - totalArea) > 0.5) {
        flagField(
          field,
          FIELD_STATUS.NEEDS_REVIEW,
          `Rechnerische Flächendiskrepanz: Summe der Flurstücke (${sumParcels} m²) weicht von Gesamtfläche (${totalArea} m²) ab.`
        );
      }
    },
  },

  // 6. Arithmetik-Guardrail: Mietverhältnisse
  {
    id: 'RENT_AMOUNT_ARITHMETIC_GUARD',
    name: 'Plausibilitätsprüfung Monatsmiete vs. Jahresreinertrag',
    evaluate({ fields }) {
      const field = fields['mietverhaeltnisse'];
      if (!field || !field.data) return;

      const mResult = MietverhaeltnisseDataSchema.partial().safeParse(field.data);
      if (!mResult.success || !mResult.data.statedInEmailOrOverview) return;

      const monthlyMatch = mResult.data.statedInEmailOrOverview.match(
        /(\d+(?:[\.,]\d+)?)\s*(?:€|eur)?\s*(?:monatlich|mtl|pro monat)/i
      );
      if (!monthlyMatch || !monthlyMatch[1]) return;

      const rawMonthly = parseFloat(monthlyMatch[1].replace(/\./g, '').replace(',', '.'));
      const yearlyCalculated = Math.round(rawMonthly * 12);
      const currentYearly = mResult.data.yearlyNetRent ?? 0;

      if (currentYearly > 0 && Math.abs(currentYearly - yearlyCalculated) > 1) {
        flagField(
          field,
          FIELD_STATUS.NEEDS_REVIEW,
          `Rechnerische Mietdiskrepanz: Monatsbetrag (${rawMonthly} €/Monat = ${yearlyCalculated} €/Jahr) weicht von erfasster Jahresmiete (${currentYearly} €) ab.`
        );
      }
    },
  },

  // 7. Urkunden-Guardrail: Handschriftliche Änderungen & Streichungen
  {
    id: 'PURCHASE_PRICE_AMENDMENT_GUARD',
    name: 'Erkennung handschriftlicher Streichungen und Paraphierungen (§ 13, § 44a BeurkG)',
    evaluate({ fields }) {
      const field = fields['kaufpreis'];
      if (!field || field.status !== FIELD_STATUS.VERIFIED) return;

      const snippet = (field.source?.snippet || '').toLowerCase();
      const note = (field.note || '').toLowerCase();
      const combinedText = `${snippet} ${note}`;

      const hasCorrectionIndicator =
        /urspruenglich|ursprünglich|gestrichen|durchgestrichen|streichung|paraphe|handschriftlich|korrektur|minderung/i.test(
          combinedText
        );

      if (hasCorrectionIndicator) {
        flagField(
          field,
          FIELD_STATUS.NEEDS_REVIEW,
          'Handschriftliche Änderung oder Streichung im Kaufvertrag – Prüfung der Genehmigung und Paraphierung aller Beteiligten vor Beurkundung erforderlich.',
          true
        );
      }
    },
  },
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
