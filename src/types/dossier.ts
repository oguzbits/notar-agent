import { z } from 'zod';

export const CASE_TYPES = {
  IMMOBILIENKAUF: 'IMMOBILIENKAUF',
  GMBH_GRUENDUNG: 'GMBH_GRUENDUNG',
} as const;

export const CaseTypeSchema = z.enum([CASE_TYPES.IMMOBILIENKAUF, CASE_TYPES.GMBH_GRUENDUNG]);
export type CaseType = (typeof CASE_TYPES)[keyof typeof CASE_TYPES];

export const FIELD_STATUS = {
  VERIFIED: 'VERIFIED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  OUTDATED: 'OUTDATED',
  MISSING: 'MISSING',
} as const;

export const FieldStatusSchema = z.enum([
  FIELD_STATUS.VERIFIED,
  FIELD_STATUS.NEEDS_REVIEW,
  FIELD_STATUS.OUTDATED,
  FIELD_STATUS.MISSING,
]);
export type FieldStatus = (typeof FIELD_STATUS)[keyof typeof FIELD_STATUS];

export const SourceLocationSchema = z.object({
  fileName: z.string().describe('Name der hochgeladenen Quelldatei oder leer'),
  pageNumber: z.number().describe('Seitenzahl im Dokument oder 0 falls nicht feststellbar'),
  snippet: z.string().describe('Exakter oder sinngemäßer Textausschnitt als Nachweis oder leer'),
});
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

export function createFieldDossierSchema<T extends z.ZodTypeAny>(dataType: T) {
  return z.object({
    data: dataType.describe('Die extrahierten und typisierten Fachdaten'),
    status: FieldStatusSchema.describe(
      'Status-Klassifizierung: VERIFIED (vollständig durch Unterlagen belegt), NEEDS_REVIEW (Widersprüche/Abweichungen/Klärungsbedarf), OUTDATED (ausschließlich bei Dokumenten mit explizit abgelaufenem Gültigkeitsdatum oder wenn ein jüngeres Nachfolgedokument desselben Typs vorliegt), MISSING (fehlt im Aktenbestand)'
    ),
    source: SourceLocationSchema.describe('Audit-Trail / Fundstelle im Dokumentensatz'),
    note: z
      .string()
      .describe(
        'Bei VERIFIED leer (""), bei Klärungsbedarf (NEEDS_REVIEW, OUTDATED, MISSING) 1 prägnanter deutscher Satz mit Begründung'
      ),
    actionRequired: z.string().optional().describe('Optional'),
  });
}

export interface GenericFieldDossier<T = Record<string, unknown>> {
  data: T;
  status: FieldStatus;
  source: SourceLocation;
  note: string;
  actionRequired?: string;
}

/**
 * Resilientes Nummernschema für KI-Outputs:
 * Wandelt formatierte Strings wie "500.000,00 €", "120 m²" oder "500000"
 * deterministisch in gültige JavaScript-Numbers um, ohne bei Formatabweichungen abzustürzen.
 */
export const NotaryNumberSchema = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return 0;
    // Bereinigt Währungszeichen, Währungscodes, Einheiten, Leerzeichen und deutsches Zahlenformat
    const cleaned = trimmed
      .replace(/\b(EUR|TEUR|CHF|USD)\b/gi, '')
      .replace(/kwh.*$/gi, '')
      .replace(/[€$£\s]/g, '')
      .replace(/m[²2]/gi, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = Number(cleaned);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
}, z.number());

// ==========================================
// 1. SCHEMATA FÜR IMMOBILIENKAUFVERTRAG
// ==========================================

export const VerkaeuferDataSchema = z.object({
  name: z
    .string()
    .describe('Name oder Firma des Verkäufers / der Eigentümer (Personen oder Gesellschaft)'),
  legalForm: z.string().describe('Rechtsform (z.B. natürliche Person, GbR, GmbH, KG)'),
  registeredOwnersGrundbuch: z
    .array(z.string())
    .describe('Im Grundbuch eingetragene Eigentümer lt. Abt. I'),
  authorizedRepresentatives: z
    .array(z.string())
    .describe(
      'Vertretungsberechtigte Personen (bei Gesellschaften: z.B. Geschäftsführer, Gesellschafter; bei Privatpersonen leer)'
    ),
  representationProofProvided: z
    .boolean()
    .describe(
      'Liegen Vertretungsnachweise vor (bei Gesellschaften z.B. HRB-Auszug/Gesellschaftsvertrag; bei im eigenen Namen handelnden Privatpersonen stets true)'
    ),
  missingProofs: z
    .array(z.string())
    .describe('Konkret fehlende Nachweise (bei Privatpersonen leer lassen)'),
});
export const VerkaeuferFieldSchema = createFieldDossierSchema(VerkaeuferDataSchema);
export type VerkaeuferData = z.infer<typeof VerkaeuferDataSchema>;

export const KaeuferDataSchema = z.object({
  companyName: z
    .string()
    .describe('Name oder Firma des Käufers (Privatperson oder juristische Person)'),
  legalForm: z.string().describe('Rechtsform (z.B. natürliche Person, GmbH, Einzelkaufmann)'),
  registerCourt: z
    .string()
    .describe('Registergericht (nur bei eingetragenen Firmen; bei Privatpersonen leer)'),
  registerNumber: z
    .string()
    .describe('Registernummer (nur bei eingetragenen Firmen; bei Privatpersonen leer)'),
  address: z.string().describe('Geschäftsanschrift oder Wohnanschrift des Käufers'),
  authorizedRepresentatives: z
    .array(z.string())
    .describe('Vertretungsberechtigte Organe (nur bei Gesellschaften; bei Privatpersonen leer)'),
  hasOfficialRegisterProof: z
    .boolean()
    .describe(
      'Liegt ein amtlicher Registerauszug vor (nur bei registerpflichtigen Gesellschaften; bei Privatpersonen stets true)?'
    ),
});
export const KaeuferFieldSchema = createFieldDossierSchema(KaeuferDataSchema);
export type KaeuferData = z.infer<typeof KaeuferDataSchema>;

export const GrundbuchDataSchema = z.object({
  amtsgericht: z.string().describe('Zuständiges Amtsgericht'),
  grundbuchBezirk: z.string().describe('Grundbuchbezirk / Grundbuch von'),
  blatt: z.string().describe('Blattnummer'),
  standDatum: z.string().describe('Datum / Stand des Grundbuchauszugs (JJJJ-MM-TT)'),
  isCurrent: z
    .boolean()
    .describe(
      'Gibt an, ob dies der jüngste im Aktenbestand vorliegende Grundbuchstand ist (true) oder durch einen neueren Auszug im Aktenbestand überholt wurde (false).'
    ),
});
export const GrundbuchFieldSchema = createFieldDossierSchema(GrundbuchDataSchema);

export const FlurstueckSchema = z.object({
  gemarkung: z.string().describe('Gemarkung'),
  flur: z.string().describe('Flur'),
  flurstueckNummer: z.string().describe('Flurstück Zähler/Nenner'),
  sizeM2: NotaryNumberSchema.describe('Fläche in Quadratmetern'),
  wirtschaftsart: z.string().describe('Wirtschaftsart und Lage lt. Bestandsverzeichnis'),
});

export const GrundstueckeDataSchema = z.object({
  parcels: z.array(FlurstueckSchema).describe('Liste aller betroffenen Flurstücke'),
  totalAreaM2: NotaryNumberSchema.describe('Gesamtfläche in m²'),
  areaDiscrepancyNotes: z
    .string()
    .describe('Abweichungen zwischen Grundbuch, Flurkarte und Bauakten falls vorhanden'),
});
export const GrundstueckeFieldSchema = createFieldDossierSchema(GrundstueckeDataSchema);

export const KaufpreisDataSchema = z.object({
  amountInFigures: NotaryNumberSchema.describe('Kaufpreisbetrag numerisch in Euro'),
  amountInWords: z.string().describe('Kaufpreisbetrag in Worten (z.B. fünfhunderttausend Euro)'),
  currency: z.string().describe('Währungscode (z.B. EUR)'),
  previousOffers: z
    .array(NotaryNumberSchema)
    .describe('Vorherige Beträge/Angebote vor Nachverhandlung'),
  priceEvolutionSummary: z.string().describe('Darstellung der Preisentwicklung / Nachverhandlung'),
  isFinalAgreedPrice: z
    .boolean()
    .describe(
      'Basiert der Betrag auf dem jüngsten übereinstimmenden Verhandlungsstand der Parteien?'
    ),
});
export const KaufpreisFieldSchema = createFieldDossierSchema(KaufpreisDataSchema);

export const FinanzierungDataSchema = z.object({
  lenderName: z.string().describe('Finanzierendes Kreditinstitut / Gläubiger'),
  mortgageAmount: NotaryNumberSchema.describe('Betrag der zu bestellenden Grundschuld in Euro'),
  requiresFinancingPowerOfAttorney: z
    .boolean()
    .describe('Wird eine Belastungsvollmacht / Finanzierungsvollmacht im Kaufvertrag benötigt?'),
  interestRateAndPawnDetails: z
    .string()
    .describe('Angaben zur Grundschuldbestellung oder Belastungsvollmacht falls erwähnt'),
});
export const FinanzierungFieldSchema = createFieldDossierSchema(FinanzierungDataSchema);

export const BelastungEntrySchema = z.object({
  section: z
    .enum(['II', 'III'])
    .describe('Abteilung II (Lasten/Beschränkungen) oder III (Grundpfandrechte)'),
  runningNumber: z.string().describe('Laufende Nummer der Eintragung'),
  description: z
    .string()
    .describe('Inhalt der Belastung (z.B. Wegerecht, Leitungsrecht, Briefgrundschuld)'),
  amount: z
    .string()
    .describe('Betrag bei Abt. III Grundschulden/Hypotheken (z.B. "100.000,00 EUR" oder "100000")'),
  creditor: z.string().describe('Gläubiger / Berechtigter'),
  intendedHandling: z
    .enum(['LOESCHUNG', 'UEBERNAHME', 'ABLOESUNG', 'UNKLAR'])
    .describe('Vorgesehenes Verfahren: Löschung, Übernahme oder Ablösung'),
  notes: z
    .string()
    .describe('Besonderheiten (z.B. Briefüberlassung, Löschungsbewilligung erforderlich)'),
});
export const BelastungenDataSchema = z.object({
  entries: z.array(BelastungEntrySchema).describe('Alle Belastungen aus Abt. II und III'),
  clearingRequirements: z
    .array(z.string())
    .describe('Erforderliche Löschungsunterlagen oder Ablöseanträge'),
});
export const BelastungenFieldSchema = createFieldDossierSchema(BelastungenDataSchema);

export const MietverhaeltnisseDataSchema = z.object({
  yearlyNetRent: NotaryNumberSchema.describe('Jahresnettomiete / Nettokaltmiete in Euro'),
  statedInEmailOrOverview: z.string().describe('Quelle des Mietbetrags'),
  rentableAreaM2: NotaryNumberSchema.describe('Gesamtwohn-/Nutzfläche vermietet in m²'),
  unitCount: NotaryNumberSchema.describe('Anzahl der Einheiten (Wohnungen/Gewerbe)'),
  fullRentedStatus: z
    .boolean()
    .describe('Gibt an, ob Vollvermietung besteht (true) oder Leerstand vorliegt (false)'),
  tenancyListAvailable: z.boolean().describe('Liegt eine Mietübersicht vor?'),
  privacyOrRedactionNotes: z
    .string()
    .describe('Hinweise zu Schwärzungen, fehlenden Namen oder Kautionsnachweisen'),
  tenancyTransferNotes: z
    .string()
    .optional()
    .describe(
      'Feststellungen zum gesetzlichen Übergang bestehender Mietverhältnisse gem. § 566 BGB und Kautionsübertragung (§ 566a BGB)'
    ),
});
export const MietverhaeltnisseFieldSchema = createFieldDossierSchema(MietverhaeltnisseDataSchema);

export const ENERGIEAUSWEIS_TYPES = {
  BEDARFSAUSWEIS: 'BEDARFSAUSWEIS',
  VERBRAUCHSAUSWEIS: 'VERBRAUCHSAUSWEIS',
  UNBEKANNT: 'UNBEKANNT',
} as const;

export const EnergieausweisTypeSchema = z.enum([
  ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
  ENERGIEAUSWEIS_TYPES.VERBRAUCHSAUSWEIS,
  ENERGIEAUSWEIS_TYPES.UNBEKANNT,
]);
export type EnergieausweisType = (typeof ENERGIEAUSWEIS_TYPES)[keyof typeof ENERGIEAUSWEIS_TYPES];

export const EnergieausweisDataSchema = z.object({
  certificateType: EnergieausweisTypeSchema.describe(
    'Art des Ausweises: Bedarfsausweis oder Verbrauchsausweis'
  ),
  energyValueKWh: NotaryNumberSchema.describe(
    'Endenergiebedarf bzw. -verbrauchskennwert in kWh/(m²*a)'
  ),
  efficiencyClass: z.string().describe('Energieeffizienzklasse (A+ bis H)'),
  validUntil: z.string().describe('Gültig bis (JJJJ-MM-TT)'),
  isExpired: z.boolean().describe('Ist der Ausweis abgelaufen oder noch gültig?'),
  primaryEnergyCarrier: z.string().describe('Wesentlicher Energieträger (z.B. Gas, Öl, Fernwärme)'),
  buildingYear: z.string().describe('Baujahr des Gebäudes lt. Energieausweis'),
});
export const EnergieausweisFieldSchema = createFieldDossierSchema(EnergieausweisDataSchema);

export const UebergabeDataSchema = z.object({
  targetDate: z.string().describe('Konkretes geplantes Übergabedatum (z.B. 2026-12-01)'),
  conditionDescription: z
    .string()
    .describe('Bedingung für Besitzübergang (z.B. nach vollständiger Kaufpreiszahlung)'),
  riskTransferNotes: z.string().describe('Regelung zu Nutzen-Lasten-Wechsel und Gefahrenübergang'),
});
export const UebergabeFieldSchema = createFieldDossierSchema(UebergabeDataSchema);

export const ImmobilienFieldsSchema = z.object({
  verkaeufer: VerkaeuferFieldSchema,
  kaeufer: KaeuferFieldSchema,
  grundbuch: GrundbuchFieldSchema,
  grundstuecke: GrundstueckeFieldSchema,
  kaufpreis: KaufpreisFieldSchema,
  finanzierung: FinanzierungFieldSchema,
  belastungen: BelastungenFieldSchema,
  mietverhaeltnisse: MietverhaeltnisseFieldSchema,
  energieausweis: EnergieausweisFieldSchema,
  uebergabe: UebergabeFieldSchema,
});
export type ImmobilienFields = z.infer<typeof ImmobilienFieldsSchema>;

// ==========================================
// 2. SCHEMATA FÜR GMBH-GRÜNDUNG
// ==========================================

export const GmbhFirmaDataSchema = z.object({
  companyName: z
    .string()
    .describe('Vollständige Firma der Gesellschaft (z.B. Muster Innovations GmbH)'),
  hasNameCheckIhk: z.boolean().describe('Liegt eine IHK-Firmenfreigabe bzw. Namensvorprüfung vor?'),
  seatCity: z.string().describe('Sitz der Gesellschaft (politische Gemeinde)'),
});
export const GmbhFirmaFieldSchema = createFieldDossierSchema(GmbhFirmaDataSchema);

export const GmbhGesellschafterPartnerSchema = z.object({
  name: z.string().describe('Name oder Firma des Gesellschafters'),
  shareAmount: z.number().describe('Nennbetrag des Geschäftsanteils in Euro'),
  sharePercent: z.number().describe('Beteiligungsquote in Prozent'),
});

export const GmbhGesellschafterDataSchema = z.object({
  partners: z
    .array(GmbhGesellschafterPartnerSchema)
    .describe('Liste aller Gründungsgesellschafter'),
  totalCapital: z.number().describe('Summe aller übernommenen Geschäftsanteile'),
});
export const GmbhGesellschafterFieldSchema = createFieldDossierSchema(GmbhGesellschafterDataSchema);

export const POWER_OF_REPRESENTATION = {
  EINZELVERTRETUNG: 'EINZELVERTRETUNG',
  GESAMTVERTRETUNG: 'GESAMTVERTRETUNG',
} as const;

export const PowerOfRepresentationSchema = z.enum([
  POWER_OF_REPRESENTATION.EINZELVERTRETUNG,
  POWER_OF_REPRESENTATION.GESAMTVERTRETUNG,
]);
export type PowerOfRepresentation =
  (typeof POWER_OF_REPRESENTATION)[keyof typeof POWER_OF_REPRESENTATION];

export const GmbhGeschaeftsfuehrerItemSchema = z.object({
  name: z.string().describe('Vollständiger Name des Geschäftsführers'),
  powerOfRepresentation: PowerOfRepresentationSchema.describe('Vertretungsbefugnis'),
  exemption181Bgb: z
    .boolean()
    .describe('Befreiung von den Beschränkungen des § 181 BGB (Selbstkontrahierungsverbot)'),
});

export const GmbhGeschaeftsfuehrerDataSchema = z.object({
  managingDirectors: z.array(GmbhGeschaeftsfuehrerItemSchema).describe('Bestellte Geschäftsführer'),
  criminalRecordCheckPassed: z
    .boolean()
    .describe('Versicherung nach § 6 Abs. 2 GmbHG (keine Verurteilungen/Ausschlüsse) belegt'),
});
export const GmbhGeschaeftsfuehrerFieldSchema = createFieldDossierSchema(
  GmbhGeschaeftsfuehrerDataSchema
);

export const CONTRIBUTION_TYPE = {
  BAREINLAGE: 'BAREINLAGE',
  SACHEINLAGE: 'SACHEINLAGE',
  GEMISCHT: 'GEMISCHT',
} as const;

export const ContributionTypeSchema = z.enum([
  CONTRIBUTION_TYPE.BAREINLAGE,
  CONTRIBUTION_TYPE.SACHEINLAGE,
  CONTRIBUTION_TYPE.GEMISCHT,
]);
export type ContributionType = (typeof CONTRIBUTION_TYPE)[keyof typeof CONTRIBUTION_TYPE];

export const GmbhStammkapitalDataSchema = z.object({
  nominalCapital: z
    .number()
    .describe('Stammkapital der GmbH in Euro (mind. 25.000 € bzw. 1 € bei UG)'),
  contributionType: ContributionTypeSchema.describe('Art der Einlage'),
  minimumDepositPaid: z
    .boolean()
    .describe('Gesetzliche Mindesteinzahlung (mind. 12.500 € bei GmbH) nachgewiesen'),
});
export const GmbhStammkapitalFieldSchema = createFieldDossierSchema(GmbhStammkapitalDataSchema);

export const GmbhUnternehmensgegenstandDataSchema = z.object({
  purposeDescription: z.string().describe('Konkreter satzungsmäßiger Gegenstand des Unternehmens'),
  requiresSpecialPermit: z
    .boolean()
    .describe('Erfordert der Gegenstand eine behördliche Erlaubnis (§ 34c GewO, KWG etc.)'),
});
export const GmbhUnternehmensgegenstandFieldSchema = createFieldDossierSchema(
  GmbhUnternehmensgegenstandDataSchema
);

export const GmbhFieldsSchema = z.object({
  firma: GmbhFirmaFieldSchema,
  gesellschafter: GmbhGesellschafterFieldSchema,
  geschaeftsfuehrer: GmbhGeschaeftsfuehrerFieldSchema,
  stammkapital: GmbhStammkapitalFieldSchema,
  unternehmensgegenstand: GmbhUnternehmensgegenstandFieldSchema,
});
export type GmbhFields = z.infer<typeof GmbhFieldsSchema>;

// ==========================================
// 3. ALLGEMEINE STRUKTUREN & GESAMTDOSSIER
// ==========================================

export const NOTAR_DOCUMENT_TYPES = {
  GRUNDBUCHAUSZUG: 'Grundbuchauszug',
  ENERGIEAUSWEIS: 'Energieausweis',
  KAUFVERTRAGSENTWURF: 'Kaufvertragsentwurf / Kaufangebot',
  MIETUEBERSICHT: 'Mietliste / Mietvertrag',
  HANDELSREGISTER: 'Handelsregisterauszug',
  PERSONALAUSWEIS: 'Ausweisdokument',
  BEARBEITUNGSNOTIZ: 'Bearbeitungsvermerk / Notiz',
  SONSTIGES: 'Sonstiges Dokument',
} as const;

export type NotarDocumentType = (typeof NOTAR_DOCUMENT_TYPES)[keyof typeof NOTAR_DOCUMENT_TYPES];

export const DOCUMENT_RELIABILITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  OBSOLETE: 'OBSOLETE',
  UNRELATED: 'UNRELATED',
} as const;

export const DocumentReliabilitySchema = z.enum([
  DOCUMENT_RELIABILITY.HIGH,
  DOCUMENT_RELIABILITY.MEDIUM,
  DOCUMENT_RELIABILITY.LOW,
  DOCUMENT_RELIABILITY.OBSOLETE,
  DOCUMENT_RELIABILITY.UNRELATED,
]);
export type DocumentReliability = (typeof DOCUMENT_RELIABILITY)[keyof typeof DOCUMENT_RELIABILITY];

export const DetectedDocumentSchema = z.object({
  fileName: z.string().describe('Ursprünglicher Dateiname'),
  documentType: z
    .string()
    .describe(
      'Erkannter notarieller Dokumenttyp (z.B. Grundbuchauszug, Energieausweis, Mietliste)'
    ),
  date: z.string().describe('Ermitteltes Dokumentendatum (JJJJ-MM-TT oder leer)'),
  pageCount: z.number().describe('Erkannte Seitenanzahl oder 0'),
  reliability: DocumentReliabilitySchema.describe('Verlässlichkeit für Beurkundung'),
  summary: z.string().optional().describe('Optional'),
});
export type DetectedDocument = z.infer<typeof DetectedDocumentSchema>;

export const INQUIRY_PRIORITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
} as const;

export const InquiryPrioritySchema = z.enum([
  INQUIRY_PRIORITY.CRITICAL,
  INQUIRY_PRIORITY.HIGH,
  INQUIRY_PRIORITY.MEDIUM,
]);
export type InquiryPriority = (typeof INQUIRY_PRIORITY)[keyof typeof INQUIRY_PRIORITY];

export const INQUIRY_RECIPIENT = {
  VERKAEUFER: 'VERKAEUFER',
  KAEUFER: 'KAEUFER',
  MAKLER: 'MAKLER',
  BANK: 'BANK',
  BEHOERDE: 'BEHOERDE',
  ALL: 'all',
} as const;

export const InquirySchema = z.object({
  id: z.string().default(() => `inq-${Math.random().toString(36).slice(2, 7)}`),
  fieldKey: z.string().default(INQUIRY_RECIPIENT.ALL),
  recipient: z.string().default(INQUIRY_RECIPIENT.VERKAEUFER),
  priority: InquiryPrioritySchema.default(INQUIRY_PRIORITY.HIGH),
  subject: z.string().default('Nachforderung'),
  message: z.string().default(''),
  justification: z.string().default(''),
  resolved: z.boolean().default(false),
});
export type Inquiry = z.infer<typeof InquirySchema>;

export const OVERALL_STATUS = {
  READY: 'READY',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  BLOCKED: 'BLOCKED',
} as const;

export const OverallStatusSchema = z.enum([
  OVERALL_STATUS.READY,
  OVERALL_STATUS.ACTION_REQUIRED,
  OVERALL_STATUS.BLOCKED,
]);
export type OverallStatus = (typeof OVERALL_STATUS)[keyof typeof OVERALL_STATUS];

export const ImmobilienDossierSchema = z.object({
  caseType: z
    .literal(CASE_TYPES.IMMOBILIENKAUF)
    .describe('Art des notariellen Vorgangs: IMMOBILIENKAUF'),
  caseTitle: z.string().describe('Aktenzeichen oder Kurzbeschreibung des Vorgangs'),
  analysisTimestamp: z.string().describe('Zeitpunkt der Analyse im ISO-Format'),
  detectedDocuments: z
    .array(DetectedDocumentSchema)
    .describe('Liste aller im Upload identifizierten Dokumente'),
  fields: ImmobilienFieldsSchema.describe(
    'Die 10 notariellen Pflichtfelder für Immobilienkaufverträge'
  ),
  inquiries: z
    .array(InquirySchema)
    .describe('Wesentliche Nachforderungen bei echten Hindernissen, sonst leeres Array []'),
  overallStatus: OverallStatusSchema.describe(
    'Gesamtreife des Vorgangs für die Entwurfserstellung'
  ),
  executiveSummary: z
    .string()
    .describe('Maximal 1 prägnanter Satz zum aktuellen Bearbeitungsstand für den Entwurf'),
  userNotes: z
    .array(z.string())
    .optional()
    .describe('Unveränderter Volltext aller vom Sachbearbeiter erfassten Notizen'),
});
export type ImmobilienDossier = z.infer<typeof ImmobilienDossierSchema>;

export const GmbhDossierSchema = z.object({
  caseType: z
    .literal(CASE_TYPES.GMBH_GRUENDUNG)
    .describe('Art des notariellen Vorgangs: GMBH_GRUENDUNG'),
  caseTitle: z.string().describe('Aktenzeichen oder Kurzbeschreibung des Vorgangs'),
  analysisTimestamp: z.string().describe('Zeitpunkt der Analyse im ISO-Format'),
  detectedDocuments: z
    .array(DetectedDocumentSchema)
    .describe('Liste aller im Upload identifizierten Dokumente'),
  fields: GmbhFieldsSchema.describe('Die notariellen Pflichtfelder für eine GmbH-Gründung'),
  inquiries: z
    .array(InquirySchema)
    .describe('Wesentliche Nachforderungen bei echten Hindernissen, sonst leeres Array []'),
  overallStatus: OverallStatusSchema.describe(
    'Gesamtreife des Vorgangs für die Entwurfserstellung'
  ),
  executiveSummary: z
    .string()
    .describe('Maximal 1 prägnanter Satz zum aktuellen Bearbeitungsstand für den Entwurf'),
  userNotes: z
    .array(z.string())
    .optional()
    .describe('Unveränderter Volltext aller vom Sachbearbeiter erfassten Notizen'),
});
export type GmbhDossier = z.infer<typeof GmbhDossierSchema>;

/**
 * Discriminated Union für alle typisierten Vorgangsarten.
 * Eliminiert unsichere Record<string, unknown> Typen und gewährleistet
 * vollständige TypeScript-Compiler-Prüfung je caseType.
 */
export const DossierSchema = z.discriminatedUnion('caseType', [
  ImmobilienDossierSchema,
  GmbhDossierSchema,
]);

export type Dossier = z.infer<typeof DossierSchema>;

/**
 * Type-Guard für Immobilienkaufvertrags-Dossiers
 */
export function isImmobilienDossier(dossier: Dossier): dossier is ImmobilienDossier {
  return dossier.caseType === CASE_TYPES.IMMOBILIENKAUF;
}

/**
 * Type-Guard für GmbH-Gründungs-Dossiers
 */
export function isGmbhDossier(dossier: Dossier): dossier is GmbhDossier {
  return dossier.caseType === CASE_TYPES.GMBH_GRUENDUNG;
}

// ==========================================
// 4. API REQUEST SCHEMATA
// ==========================================

export const UploadedFilePayloadSchema = z.object({
  name: z.string().min(1, 'Dateiname darf nicht leer sein'),
  type: z.string(),
  size: z.number().nonnegative(),
  content: z.string().optional(),
  isBase64: z.boolean().optional(),
});
export type UploadedFilePayload = z.infer<typeof UploadedFilePayloadSchema>;

export const AnalyzeRequestSchema = z
  .object({
    files: z.array(UploadedFilePayloadSchema).default([]),
    caseType: CaseTypeSchema.default(CASE_TYPES.IMMOBILIENKAUF),
    notes: z.string().default(''),
    documentId: z.string().optional(),
    organizationId: z.uuid().optional(),
    existingDossier: DossierSchema.optional(),
  })
  .refine(
    (data) => {
      // Wenn keine Dateien übermittelt werden, müssen entweder ein bestehendes Dossier oder Notizen vorliegen
      if (data.files.length === 0) {
        return Boolean(data.existingDossier || data.notes.trim());
      }
      return true;
    },
    {
      message: 'Keine Dokumente oder Notizen für die Aktualisierung übermittelt.',
      path: ['files'],
    }
  );
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const UpdateDossierRequestSchema = z.object({
  documentId: z.string().min(1, 'documentId ist erforderlich.'),
  organizationId: z.uuid().optional(),
  dossier: DossierSchema,
  auditOverride: z
    .object({
      fieldKey: z.string().min(1),
      fieldTitle: z.string().optional(),
      previousStatus: FieldStatusSchema,
      newStatus: FieldStatusSchema,
      reason: z.string().min(3),
    })
    .optional(),
  actor: z.string().optional(),
  actorRole: z.string().optional(),
});
export type UpdateDossierRequest = z.infer<typeof UpdateDossierRequestSchema>;

// ==========================================
// 5. STORAGE & PERSISTENCE METADATA
// ==========================================

export const STORAGE_TYPES = {
  SUPABASE: 'supabase',
  LOCAL_ONLY: 'local-only',
} as const;

export const StorageTypeSchema = z.enum([STORAGE_TYPES.SUPABASE, STORAGE_TYPES.LOCAL_ONLY]);
export type StorageType = (typeof STORAGE_TYPES)[keyof typeof STORAGE_TYPES];

export const PersistenceMetaSchema = z.object({
  id: z.string().optional(),
  storageType: StorageTypeSchema,
  caseNumber: z.string(),
  persisted: z.boolean().optional(),
});
export type PersistenceMeta = z.infer<typeof PersistenceMetaSchema>;
