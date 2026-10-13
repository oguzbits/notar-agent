import {
  EnergieausweisDataSchema,
  FIELD_STATUS,
  MietverhaeltnisseDataSchema,
} from '@/types/dossier';
import { flagField, GuardrailRule } from './guardrail-types';

export function parseGermanOrIsoDate(raw: string): string | null {
  const clean = raw.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('.');
    return `${y}-${m}-${d}`;
  }
  return null;
}

export const ENERGY_CERTIFICATE_EXPIRY_GUARD: GuardrailRule = {
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
};

export const PARCEL_AREA_ARITHMETIC_GUARD: GuardrailRule = {
  id: 'PARCEL_AREA_ARITHMETIC_GUARD',
  name: 'Flächenkonsistenz der Flurstücke vs. Gesamtfläche',
  evaluate({ fields }) {
    const field = fields['grundstuecke'];
    if (!field?.data || typeof field.data !== 'object') return;

    const rawData = field.data as Record<string, unknown>;
    const rawParcels = Array.isArray(rawData.parcels) ? rawData.parcels : [];
    if (rawParcels.length === 0) return;

    const sumParcels = rawParcels.reduce((acc: number, p: unknown) => {
      const val = Number((p as { sizeM2?: unknown })?.sizeM2 ?? 0);
      return acc + (isNaN(val) ? 0 : val);
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
};

export const RENT_AMOUNT_ARITHMETIC_GUARD: GuardrailRule = {
  id: 'RENT_AMOUNT_ARITHMETIC_GUARD',
  name: 'Plausibilitätsprüfung Monatsmiete vs. Jahresreinertrag',
  evaluate({ fields }) {
    const field = fields['mietverhaeltnisse'];
    if (!field?.data) return;

    const mResult = MietverhaeltnisseDataSchema.partial().safeParse(field.data);
    if (!mResult.success || !mResult.data.statedInEmailOrOverview) return;

    const monthlyMatch = mResult.data.statedInEmailOrOverview.match(
      /(\d+(?:[\.,]\d+)?)\s*(?:€|eur)?\s*(?:monatlich|mtl|pro monat)/i
    );
    if (!monthlyMatch?.[1]) return;

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
};

export const PURCHASE_PRICE_AMENDMENT_GUARD: GuardrailRule = {
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
};

export const ARITHMETIC_GUARDRAIL_RULES: readonly GuardrailRule[] = [
  ENERGY_CERTIFICATE_EXPIRY_GUARD,
  PARCEL_AREA_ARITHMETIC_GUARD,
  RENT_AMOUNT_ARITHMETIC_GUARD,
  PURCHASE_PRICE_AMENDMENT_GUARD,
] as const;
