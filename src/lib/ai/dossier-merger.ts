import { guardAuditorPatch } from '@/lib/ai/auditor-patch-guard';
import { carryOverReviews } from '@/lib/dossier/state';
import { createEmptyImmobilienFields } from '@/lib/dossier-defaults';
import { logEvent } from '@/lib/observability/logger';
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
  FIELD_STATUS,
} from '@/types/dossier';
import { VERIFICATION_FLAGGED_FIELDS_KEY } from '@/types/pipeline';

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
  if (!inq || typeof inq !== 'object') {
    return {
      id: `inq-${idx + 1}`,
      fieldKey: INQUIRY_RECIPIENT.ALL,
      recipient: INQUIRY_RECIPIENT.VERKAEUFER,
      priority: INQUIRY_PRIORITY.HIGH,
      subject: 'Nachforderung',
      message: '',
      justification: '',
      resolved: false,
    };
  }

  const item = inq as Record<string, unknown>;
  const priority =
    typeof item.priority === 'string' &&
    Object.values(INQUIRY_PRIORITY).includes(item.priority as Inquiry['priority'])
      ? (item.priority as Inquiry['priority'])
      : INQUIRY_PRIORITY.HIGH;

  const rawMsg = item.message ?? item.description ?? '';

  return {
    id: String(item.id || `inq-${idx + 1}`),
    fieldKey: String(item.fieldKey || INQUIRY_RECIPIENT.ALL),
    recipient: String(item.recipient || INQUIRY_RECIPIENT.VERKAEUFER),
    priority,
    subject: String(item.subject || 'Nachforderung'),
    message: String(rawMsg),
    justification: String(item.justification ?? ''),
    resolved: Boolean(item.resolved ?? false),
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

  // Fail-closed: Der Auditor sieht die Dokumente nicht. Bestätigt ist nur, was der Beleg-Abgleich in Stufe 1
  // belegt hat; eine Beanstandung hebt er nie auf, und umgeschriebene Belege gelten nicht mehr als geprüft.
  const flaggedRaw = parsedExtractionRaw[VERIFICATION_FLAGGED_FIELDS_KEY];
  const flaggedKeys = new Set(
    Array.isArray(flaggedRaw) ? flaggedRaw.filter((k): k is string => typeof k === 'string') : []
  );

  for (const [key, modField] of Object.entries(parsedAuditorModifications)) {
    const base = mergedFieldsRecord[key];
    if (!base) continue;
    const patch = modField as Partial<GenericFieldDossier<Record<string, unknown>>>;
    const guarded = guardAuditorPatch(base, patch, flaggedKeys.has(key));
    mergedFieldsRecord[key] = mergeField(base, guarded);
  }

  // Freigabe („bereit“) setzt voraus, dass alle Felder belegt sind, auch wenn der Auditor „bereit“ meldet
  const hasOpenField = Object.values(mergedFieldsRecord).some(
    (field) => field.status !== FIELD_STATUS.VERIFIED
  );
  const overallStatus: OverallStatus =
    hasOpenField && rawOverallStatus === OVERALL_STATUS.READY
      ? OVERALL_STATUS.ACTION_REQUIRED
      : rawOverallStatus;

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
    overallStatus,
    executiveSummary: rawExecutiveSummary || 'Analyse abgeschlossen.',
  };

  const parseResult = ImmobilienDossierSchema.safeParse(rawImmobilienPayload);
  if (!parseResult.success) {
    logEvent({ level: 'warn', event: 'immobilien_validierung_fallback' });
  }

  const dossier: Dossier = parseResult.success
    ? { ...parseResult.data, caseType: CASE_TYPES.IMMOBILIENKAUF }
    : (rawImmobilienPayload as Dossier);

  if (existingDossier && existingDossier.detectedDocuments) {
    const currentNames = new Set(dossier.detectedDocuments.map((d) => d.fileName.toLowerCase()));
    for (const prevDoc of existingDossier.detectedDocuments) {
      if (!currentNames.has(prevDoc.fileName.toLowerCase())) {
        dossier.detectedDocuments.unshift(prevDoc);
      }
    }
  }

  return carryOverReviews(existingDossier, dossier);
}
