import { createEmptyImmobilienFields } from '@/lib/dossier-defaults';
import {
  CaseType,
  CASE_TYPES,
  Dossier,
  GenericFieldDossier,
  ImmobilienFields,
  Inquiry,
  OVERALL_STATUS,
  OverallStatus,
  INQUIRY_RECIPIENT,
  INQUIRY_PRIORITY,
  ImmobilienDossierSchema,
} from '@/types/dossier';

export interface MergeDossierParams {
  caseType: CaseType;
  existingDossier?: Dossier;
  parsedExtractionRaw: Record<string, unknown>;
  parsedAuditorModifications: Record<string, unknown>;
  auditorOverallStatus?: OverallStatus;
  auditorExecutiveSummary?: string;
  auditorCaseTitle?: string;
  auditorInquiries?: unknown[];
}

/**
 * Mergt Stufe-1 Extraktion, Stufe-2 Delta-Reconciliation und eventuell existierende Dossiers deterministisch zusammen.
 */
export function mergeDossierStages(params: MergeDossierParams): Dossier {
  const {
    caseType,
    existingDossier,
    parsedExtractionRaw,
    parsedAuditorModifications,
    auditorOverallStatus,
    auditorExecutiveSummary,
    auditorCaseTitle,
    auditorInquiries,
  } = params;

  const currentAnalysisTimestamp = new Date().toISOString();

  const rawCaseTitle =
    auditorCaseTitle ||
    (typeof parsedExtractionRaw.caseTitle === 'string' && parsedExtractionRaw.caseTitle) ||
    existingDossier?.caseTitle;

  const rawExecutiveSummary =
    auditorExecutiveSummary ||
    (typeof parsedExtractionRaw.executiveSummary === 'string'
      ? parsedExtractionRaw.executiveSummary
      : '');

  const rawOverallStatus: OverallStatus =
    auditorOverallStatus ||
    (typeof parsedExtractionRaw.overallStatus === 'string' &&
    Object.values(OVERALL_STATUS).includes(parsedExtractionRaw.overallStatus as OverallStatus)
      ? (parsedExtractionRaw.overallStatus as OverallStatus)
      : OVERALL_STATUS.ACTION_REQUIRED);

  let dossier: Dossier;
  const emptyFields = createEmptyImmobilienFields();

  const stage1Fields = (
    parsedExtractionRaw.fields && typeof parsedExtractionRaw.fields === 'object'
      ? parsedExtractionRaw.fields
      : {}
  ) as Record<string, Partial<GenericFieldDossier<Record<string, unknown>>>>;

  const baseFields: ImmobilienFields =
    existingDossier && existingDossier.fields
      ? { ...(existingDossier.fields as ImmobilienFields) }
      : { ...emptyFields };
  const mergedFields: ImmobilienFields = { ...baseFields };
  const mergedFieldsRecord = mergedFields as Record<string, GenericFieldDossier>;

  // Schritt 1: Stufe-1 Extraktionen einmergen
  for (const [key, rawField] of Object.entries(stage1Fields)) {
    if (rawField && mergedFieldsRecord[key]) {
      mergedFieldsRecord[key] = {
        data: {
          ...mergedFieldsRecord[key].data,
          ...(rawField.data || {}),
        },
        status: rawField.status || mergedFieldsRecord[key].status,
        source: {
          ...mergedFieldsRecord[key].source,
          ...(rawField.source || {}),
        },
        note: rawField.note ?? mergedFieldsRecord[key].note,
        actionRequired: rawField.actionRequired ?? mergedFieldsRecord[key].actionRequired,
      };
    }
  }

  // Schritt 2: Stufe-2 Reconciler Modifikationen (Delta) gezielt darüber mergen
  for (const [key, modField] of Object.entries(parsedAuditorModifications)) {
    const rawMod = modField as Partial<GenericFieldDossier<Record<string, unknown>>>;
    if (rawMod && mergedFieldsRecord[key]) {
      mergedFieldsRecord[key] = {
        data: {
          ...mergedFieldsRecord[key].data,
          ...(rawMod.data || {}),
        },
        status: rawMod.status || mergedFieldsRecord[key].status,
        source: {
          ...mergedFieldsRecord[key].source,
          ...(rawMod.source || {}),
        },
        note: rawMod.note ?? mergedFieldsRecord[key].note,
        actionRequired: rawMod.actionRequired ?? mergedFieldsRecord[key].actionRequired,
      };
    }
  }

  const rawInquiriesList =
    auditorInquiries ||
    (Array.isArray(parsedExtractionRaw.inquiries) ? parsedExtractionRaw.inquiries : []);

  const normalizedInquiries: Inquiry[] = (
    Array.isArray(rawInquiriesList) ? rawInquiriesList : []
  ).map((inq: unknown, idx: number): Inquiry => {
    const item = inq && typeof inq === 'object' ? (inq as Record<string, unknown>) : {};
    const priority =
      typeof item.priority === 'string' &&
      Object.values(INQUIRY_PRIORITY).includes(item.priority as Inquiry['priority'])
        ? (item.priority as Inquiry['priority'])
        : INQUIRY_PRIORITY.HIGH;

    return {
      id: typeof item.id === 'string' && item.id ? item.id : `inq-${idx + 1}`,
      fieldKey:
        typeof item.fieldKey === 'string' && item.fieldKey ? item.fieldKey : INQUIRY_RECIPIENT.ALL,
      recipient:
        typeof item.recipient === 'string' && item.recipient
          ? item.recipient
          : INQUIRY_RECIPIENT.VERKAEUFER,
      priority,
      subject: typeof item.subject === 'string' && item.subject ? item.subject : 'Nachforderung',
      message:
        typeof item.message === 'string' && item.message
          ? item.message
          : typeof item.description === 'string'
            ? item.description
            : '',
      justification: typeof item.justification === 'string' ? item.justification : '',
      resolved: typeof item.resolved === 'boolean' ? item.resolved : false,
    };
  });

  const fallbackCaseTitle =
    rawCaseTitle || `Immobilienkauf ${new Date().toLocaleDateString('de-DE')}`;
  const rawImmobilienPayload = {
    caseType: caseType || CASE_TYPES.IMMOBILIENKAUF,
    caseTitle: fallbackCaseTitle,
    analysisTimestamp: currentAnalysisTimestamp,
    detectedDocuments: Array.isArray(parsedExtractionRaw.detectedDocuments)
      ? parsedExtractionRaw.detectedDocuments
      : [],
    fields: mergedFields,
    inquiries: normalizedInquiries,
    overallStatus: rawOverallStatus,
    executiveSummary: rawExecutiveSummary || 'Analyse abgeschlossen.',
  };

  const parseResult = ImmobilienDossierSchema.safeParse(rawImmobilienPayload);
  if (!parseResult.success) {
    console.warn(
      'Immobilien Zod Validierungswarnung (nutze Fallback):',
      parseResult.error.format()
    );
    dossier = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      caseTitle: rawCaseTitle || `Immobilienkauf ${new Date().toLocaleDateString('de-DE')}`,
      analysisTimestamp: currentAnalysisTimestamp,
      detectedDocuments: Array.isArray(parsedExtractionRaw.detectedDocuments)
        ? parsedExtractionRaw.detectedDocuments
        : [],
      fields: mergedFields,
      inquiries: normalizedInquiries,
      overallStatus: rawOverallStatus,
      executiveSummary: rawExecutiveSummary || 'Analyse abgeschlossen.',
    };
  } else {
    dossier = {
      ...parseResult.data,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
    };
  }

  if (existingDossier && existingDossier.detectedDocuments) {
    const currentNames = new Set(dossier.detectedDocuments.map((d) => d.fileName.toLowerCase()));
    for (const prevDoc of existingDossier.detectedDocuments) {
      if (!currentNames.has(prevDoc.fileName.toLowerCase())) {
        dossier.detectedDocuments.unshift(prevDoc);
      }
    }
  }

  return dossier;
}
