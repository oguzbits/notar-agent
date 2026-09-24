import { isEntityMatch } from '@/lib/dossier/entity-reconciliation';
import {
  EnergieausweisDataSchema,
  FIELD_STATUS,
  GenericFieldDossier,
  KaeuferDataSchema,
  MietverhaeltnisseDataSchema,
  VerkaeuferDataSchema,
} from '@/types/dossier';

export interface DomainGuardrailsOptions {
  referenceDate?: Date;
}

/**
 * Notarielle Sachverhalts- und Plausibilitätsprüfungen (Knowledge / Policy Layer)
 *
 * Separation of Policy and Mechanism (AGENTS.md):
 * - Mechanism (src/types/, src/lib/dossier/): rein technische Modellierung, Datenhygiene & Arithmetik
 * - Policy / Knowledge (PostgreSQL knowledge_documents): materielle Rechtsregeln & Subsumtion
 * - ZERO hardcoded paragraphs in application code.
 */
export function applyNotaryDomainGuardrails(
  fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>> | undefined>,
  options?: DomainGuardrailsOptions
): void {
  const refDate = options?.referenceDate ?? new Date();
  const refDateIso = refDate.toISOString().slice(0, 10);

  // 1. Generische Konsistenz: Ein Feld darf niemals 'VERIFIED' sein, wenn das data-Objekt leer ist
  for (const field of Object.values(fieldsObj)) {
    if (field && field.status === FIELD_STATUS.VERIFIED) {
      const d = field.data;
      const hasValues =
        d &&
        typeof d === 'object' &&
        Object.values(d).some((v) => {
          if (v === null || v === undefined || v === '') return false;
          if (Array.isArray(v) && v.length === 0) return false;
          if (typeof v === 'number' && v === 0) return false;
          if (typeof v === 'boolean' && v === false) return false;
          return true;
        });
      if (!hasValues) {
        field.status = FIELD_STATUS.NEEDS_REVIEW;
        if (!field.note) {
          field.note = 'Angaben unvollständig – Datenwert zur Beurkundung erforderlich.';
        }
      }
    }
  }

  // 2. Eigentümeridentität & Vertretungsberechtigung (Entity Reconciliation)
  const verkaeuferField = fieldsObj['verkaeufer'];
  if (verkaeuferField && verkaeuferField.data && verkaeuferField.status === FIELD_STATUS.VERIFIED) {
    const vResult = VerkaeuferDataSchema.partial().safeParse(verkaeuferField.data);
    const vData = vResult.success ? vResult.data : {};

    if (
      Array.isArray(vData.registeredOwnersGrundbuch) &&
      vData.registeredOwnersGrundbuch.length > 0 &&
      vData.name
    ) {
      const matchesOwner = vData.registeredOwnersGrundbuch.some((owner) =>
        isEntityMatch(vData.name || '', owner)
      );

      if (!matchesOwner && !vData.representationProofProvided) {
        verkaeuferField.status = FIELD_STATUS.NEEDS_REVIEW;
        verkaeuferField.note =
          'Eigentümer lt. Grundbuch weicht vom handelnden Verkäufer ab – Nachweis der Verfügungsbefugnis oder Erbnachweis erforderlich.';
      }
    }

    // Vertretungsnachweis juristischer Personen
    const isCorporate =
      vData.legalForm &&
      !['natürliche person', 'privatperson', 'einzelperson'].includes(
        vData.legalForm.toLowerCase().trim()
      );
    if (isCorporate && vData.representationProofProvided === false) {
      verkaeuferField.status = FIELD_STATUS.NEEDS_REVIEW;
      if (!verkaeuferField.note) {
        verkaeuferField.note = 'Vertretungsnachweis der Gesellschaft vor Beurkundung erforderlich.';
      }
    }
  }

  // 3. Registerauszug bei Käufergesellschaften
  const kaeuferField = fieldsObj['kaeufer'];
  if (kaeuferField && kaeuferField.data && kaeuferField.status === FIELD_STATUS.VERIFIED) {
    const kResult = KaeuferDataSchema.partial().safeParse(kaeuferField.data);
    const kData = kResult.success ? kResult.data : {};

    const isCorporate =
      kData.legalForm &&
      !['natürliche person', 'privatperson', 'einzelperson'].includes(
        kData.legalForm.toLowerCase().trim()
      );
    if (isCorporate && kData.hasOfficialRegisterProof === false) {
      kaeuferField.status = FIELD_STATUS.NEEDS_REVIEW;
      if (!kaeuferField.note) {
        kaeuferField.note =
          'Amtlicher Registerauszug der Käufergesellschaft fehlt bisher im Aktenbestand.';
      }
    }
  }

  // 4. Deterministische Fristenprüfung: Energieausweis Gültigkeit
  const energieField = fieldsObj['energieausweis'];
  if (energieField && energieField.data) {
    const eResult = EnergieausweisDataSchema.partial().safeParse(energieField.data);
    if (eResult.success && eResult.data.validUntil) {
      const validUntilClean = eResult.data.validUntil.trim().slice(0, 10);
      let isoDate = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(validUntilClean)) {
        isoDate = validUntilClean;
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(validUntilClean)) {
        const [day, month, year] = validUntilClean.split('.');
        isoDate = `${year}-${month}-${day}`;
      }

      if (isoDate) {
        if (isoDate < refDateIso) {
          energieField.status = FIELD_STATUS.OUTDATED;
          energieField.data.isExpired = true;
          if (!energieField.note || !energieField.note.includes('abgelaufen')) {
            energieField.note = `Gültigkeitsdauer des Energieausweises zum Stichtag (${validUntilClean}) abgelaufen.`;
          }
        }
      }
    }
  }

  // 5. Deterministische Arithmetik-Guardrails: Flurstücksflächen
  const grundstueckeField = fieldsObj['grundstuecke'];
  if (grundstueckeField && grundstueckeField.data && typeof grundstueckeField.data === 'object') {
    const rawData = grundstueckeField.data as Record<string, unknown>;
    const rawParcels = Array.isArray(rawData.parcels) ? rawData.parcels : [];
    if (rawParcels.length > 0) {
      const sumParcels = rawParcels.reduce((acc: number, p: unknown) => {
        if (p && typeof p === 'object' && 'sizeM2' in p) {
          const val = Number((p as { sizeM2?: unknown }).sizeM2);
          return acc + (isNaN(val) ? 0 : val);
        }
        return acc;
      }, 0);

      const totalArea = Number(rawData.totalAreaM2 ?? 0);

      if (totalArea > 0 && sumParcels > 0 && Math.abs(sumParcels - totalArea) > 0.5) {
        grundstueckeField.status = FIELD_STATUS.NEEDS_REVIEW;
        if (!grundstueckeField.note) {
          grundstueckeField.note = `Rechnerische Flächendiskrepanz: Summe der Flurstücke (${sumParcels} m²) weicht von Gesamtfläche (${totalArea} m²) ab.`;
        }
      }
    }
  }

  // 6. Deterministische Arithmetik-Guardrails: Mietverhältnisse
  const mietField = fieldsObj['mietverhaeltnisse'];
  if (mietField && mietField.data) {
    const mResult = MietverhaeltnisseDataSchema.partial().safeParse(mietField.data);
    if (mResult.success && mResult.data.statedInEmailOrOverview) {
      // Erkennung von Monatsbeträgen im Freitext ("2.500 € monatlich", "2500 mtl")
      const monthlyMatch = mResult.data.statedInEmailOrOverview.match(
        /(\d+(?:[\.,]\d+)?)\s*(?:€|eur)?\s*(?:monatlich|mtl|pro monat)/i
      );
      if (monthlyMatch && monthlyMatch[1]) {
        const rawMonthly = parseFloat(monthlyMatch[1].replace(/\./g, '').replace(',', '.'));
        const yearlyCalculated = Math.round(rawMonthly * 12);
        const currentYearly = mResult.data.yearlyNetRent ?? 0;

        if (currentYearly > 0 && Math.abs(currentYearly - yearlyCalculated) > 1) {
          mietField.status = FIELD_STATUS.NEEDS_REVIEW;
          if (!mietField.note) {
            mietField.note = `Rechnerische Mietdiskrepanz: Monatsbetrag (${rawMonthly} €/Monat = ${yearlyCalculated} €/Jahr) weicht von erfasster Jahresmiete (${currentYearly} €) ab.`;
          }
        }
      }
    }
  }
}
