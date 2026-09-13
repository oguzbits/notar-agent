import {
  FIELD_STATUS,
  GenericFieldDossier,
  KaeuferDataSchema,
  VerkaeuferDataSchema,
} from '@/types/dossier';

/**
 * Notarielle Sachverhalts- und Plausibilitätsprüfungen (Knowledge / Policy Layer)
 *
 * Separation of Policy and Mechanism (AGENTS.md):
 * - Mechanism (src/types/, src/lib/dossier/): rein technische Modellierung & Datenhygiene
 * - Policy / Knowledge (src/lib/knowledge/): materielle Rechtsregeln & Ausnahmetatbestände
 */
export function applyNotaryDomainGuardrails(
  fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>> | undefined>
): void {
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

  // 2. Eigentümeridentität & Erbnachweis (§ 35 GBO)
  const verkaeuferField = fieldsObj['verkaeufer'];
  if (verkaeuferField && verkaeuferField.status === FIELD_STATUS.VERIFIED && verkaeuferField.data) {
    const vResult = VerkaeuferDataSchema.partial().safeParse(verkaeuferField.data);
    const vData = vResult.success ? vResult.data : {};

    if (
      Array.isArray(vData.registeredOwnersGrundbuch) &&
      vData.registeredOwnersGrundbuch.length > 0 &&
      vData.name
    ) {
      const vNameClean = vData.name.toLowerCase().trim();
      const matchesOwner = vData.registeredOwnersGrundbuch.some((owner) => {
        const oClean = owner.toLowerCase().trim();
        return oClean.includes(vNameClean) || vNameClean.includes(oClean);
      });

      if (!matchesOwner && !vData.representationProofProvided) {
        verkaeuferField.status = FIELD_STATUS.NEEDS_REVIEW;
        verkaeuferField.note =
          'Eigentümer lt. Grundbuch weicht vom handelnden Verkäufer ab – Erbnachweis (§ 35 GBO) oder Vollmacht erforderlich.';
      }
    }

    // Vertretungsnachweis juristischer Personen (§ 12 HGB, § 21 BNotO)
    const isCorporate =
      vData.legalForm &&
      !['natürliche person', 'privatperson', 'einzelperson'].includes(
        vData.legalForm.toLowerCase().trim()
      );
    if (isCorporate && vData.representationProofProvided === false) {
      verkaeuferField.status = FIELD_STATUS.NEEDS_REVIEW;
      if (!verkaeuferField.note) {
        verkaeuferField.note =
          'Vertretungsnachweis der Gesellschaft vor Beurkundung erforderlich (§ 12 HGB, § 21 BNotO).';
      }
    }
  }

  // 3. Registerauszug bei Käufergesellschaften (§ 12 HGB)
  const kaeuferField = fieldsObj['kaeufer'];
  if (kaeuferField && kaeuferField.status === FIELD_STATUS.VERIFIED && kaeuferField.data) {
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
}
