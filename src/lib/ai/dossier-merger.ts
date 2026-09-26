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

function mergeField(
  base: GenericFieldDossier,
  patch?: Partial<GenericFieldDossier<Record<string, unknown>>>
): GenericFieldDossier {
  if (!patch) return base;
  return {
    data: { ...base.data, ...(patch.data || {}) },
    status: patch.status || base.status,
    source: { ...base.source, ...(patch.source || {}) },
    note: patch.note ?? base.note,
    actionRequired: patch.actionRequired ?? base.actionRequired,
  };
}

function normalizeInquiry(inq: unknown, idx: number): Inquiry {
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

  const baseFields: ImmobilienFields = existingDossier?.fields
    ? { ...(existingDossier.fields as ImmobilienFields) }
    : createEmptyImmobilienFields();
  const mergedFields: ImmobilienFields = { ...baseFields };
  const mergedFieldsRecord = mergedFields as Record<string, GenericFieldDossier>;

  const stage1Fields = (
    parsedExtractionRaw.fields && typeof parsedExtractionRaw.fields === 'object'
      ? parsedExtractionRaw.fields
      : {}
  ) as Record<string, Partial<GenericFieldDossier<Record<string, unknown>>>>;

  // Stufe-1 Extraktionen und Stufe-2 Reconciler Modifikationen deterministisch einmergen
  for (const [key, rawField] of Object.entries(stage1Fields)) {
    if (mergedFieldsRecord[key]) {
      mergedFieldsRecord[key] = mergeField(mergedFieldsRecord[key], rawField);
    }
  }

  for (const [key, modField] of Object.entries(parsedAuditorModifications)) {
    if (mergedFieldsRecord[key]) {
      mergedFieldsRecord[key] = mergeField(
        mergedFieldsRecord[key],
        modField as Partial<GenericFieldDossier<Record<string, unknown>>>
      );
    }
  }

  const rawInquiriesList =
    auditorInquiries ||
    (Array.isArray(parsedExtractionRaw.inquiries) ? parsedExtractionRaw.inquiries : []);

  const normalizedInquiries: Inquiry[] = (
    Array.isArray(rawInquiriesList) ? rawInquiriesList : []
  ).map(normalizeInquiry);

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

  let dossier: Dossier;
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
