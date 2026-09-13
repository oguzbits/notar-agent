import { z } from 'zod';

export const AuditRuleCategorySchema = z.enum([
  'GRUNDBUCH_SACHENRECHT',
  'PERSONEN_VERTRETUNG',
  'ENERGIE_BAU_UMWELT',
  'ZAHLUNG_TREUHAND',
  'FORMVORSCHRIFTEN',
]);
export type AuditRuleCategory = z.infer<typeof AuditRuleCategorySchema>;

export const AuditRuleSchema = z.object({
  id: z.string(),
  category: AuditRuleCategorySchema,
  legalBasis: z.string().describe('Konkrete Paragraphenbelege, z.B. § 707 BGB, § 12 HGB'),
  title: z.string(),
  triggerKeywords: z.array(z.string()).describe('Suchbegriffe oder Merkmale im Aktenbestand'),
  isGlobal: z
    .boolean()
    .default(false)
    .describe('Wenn true, wird die Regel für den CaseType immer injiziert'),
  instruction: z.string().describe('Präzise Prüfanweisung für den Auditor'),
  suggestedAction: z.string().optional().describe('Konkrete Handlungsempfehlung bei Mängeln'),
});
export type AuditRule = z.infer<typeof AuditRuleSchema>;

export const NOTARY_AUDIT_RULES: AuditRule[] = [
  {
    id: 'RULE_GEG_10_YEARS',
    category: 'ENERGIE_BAU_UMWELT',
    legalBasis: '§ 80 Abs. 2 GEG',
    title: 'Gültigkeit von Energieausweisen (10 Jahre)',
    triggerKeywords: ['energieausweis', 'bedarfsausweis', 'verbrauchsausweis'],
    isGlobal: true,
    instruction:
      'Energieausweise sind gem. § 80 Abs. 2 GEG genau 10 Jahre ab Ausstellungsdatum gültig. Liegt das Ablaufdatum vor dem Bearbeitungsstichtag, MUSS das Feld als OUTDATED (isExpired: true) markiert werden.',
    suggestedAction: 'Aktuellen Energieausweis beim Verkäufer oder Eigentümer anfordern.',
  },
  {
    id: 'RULE_BEURKG_21_GRUNDBUCH',
    category: 'GRUNDBUCH_SACHENRECHT',
    legalBasis: '§ 21 BeurkG',
    title: 'Grundbuchstand & Amtliche Einsicht',
    triggerKeywords: ['grundbuch', 'grundbuchauszug', 'blatt'],
    isGlobal: true,
    instruction:
      'Grundbuchauszüge verfallen nicht kalendarisch und belegen den Aktenstand (VERIFIED). Liegt das Auszugsdatum länger zurück, ist ein neutraler Hinweis auf die vor Beurkundung erforderliche amtliche Grundbucheinsicht gem. § 21 BeurkG in note zu vermerken.',
    suggestedAction: 'Amtliche Grundbucheinsicht unmittelbar vor dem Beurkundungstermin vornehmen.',
  },
  {
    id: 'RULE_MOPEG_EGBR',
    category: 'PERSONEN_VERTRETUNG',
    legalBasis: '§ 707 BGB, § 47 Abs. 2 GBO n.F. (MoPeG)',
    title: 'eGbR-Voreintragungspflicht bei Immobiliengeschäften',
    triggerKeywords: ['gbr', 'gesellschaft bürgerlichen rechts', 'egbr'],
    isGlobal: false,
    instruction:
      'Seit Inkrafttreten des MoPeG muss eine rechtsfähige GbR im neuen Gesellschaftsregister (eGbR) eingetragen sein, um im Grundbuch als Eigentümerin eingetragen zu werden oder über ein Grundstück zu verfügen (§ 47 Abs. 2 GBO). Fehlt der Registerauszug (GsR) oder der Namenszusatz "eGbR", ist das Feld auf NEEDS_REVIEW zu setzen und ein Nachweis der Eintragung nachzufordern.',
    suggestedAction: 'Eintragungsnachweis aus dem Gesellschaftsregister (eGbR) zur Akte anfordern.',
  },
  {
    id: 'RULE_HGB_12_REGISTER',
    category: 'PERSONEN_VERTRETUNG',
    legalBasis: '§ 12 HGB, § 21 BNotO',
    title: 'Vertretungsnachweis juristischer Personen',
    triggerKeywords: ['gmbh', 'ug', 'ag', 'kg', 'ohg', 'gmbh & co'],
    isGlobal: false,
    instruction:
      'Bei eingetragenen Handelsgesellschaften (GmbH, UG, AG, KG, OHG) muss ein amtlicher Handelsregisterauszug vorliegen und die Vertretungsbefugnis (Einzel- vs. Gesamtvertretung) feststehen. Fehlt der Registerauszug, ist das Feld auf NEEDS_REVIEW zu setzen und eine gezielte Nachforderung (inquiry) zu stellen.',
    suggestedAction:
      'Handelsregisterauszug (HRB/HRA) amtlich abrufen oder vom Beteiligten einreichen lassen.',
  },
  {
    id: 'RULE_MABV_RATES',
    category: 'ZAHLUNG_TREUHAND',
    legalBasis: '§ 3 MaBV, § 650u BGB',
    title: 'MaBV-Ratenstaffel bei Bauträgerverträgen',
    triggerKeywords: ['bauträger', 'baufortschritt', 'mabv', 'raten', 'teilzahlungen'],
    isGlobal: false,
    instruction:
      'Werden Raten nach Baufortschritt vereinbart, müssen die Fälligkeitsstufen zwingend den gesetzlichen Prozentsätzen des § 3 MaBV entsprechen. Weicht die Ratenstaffel ab oder fehlen Baufortschritts-Nachweise, ist das Feld kaufpreis auf NEEDS_REVIEW zu setzen.',
    suggestedAction: 'Kaufpreis-Ratenplan mit den Höchstsätzen des § 3 MaBV abgleichen.',
  },
  {
    id: 'RULE_BGB_566_MIETE',
    category: 'GRUNDBUCH_SACHENRECHT',
    legalBasis: '§ 566, § 566a BGB',
    title: 'Kauf bricht nicht Miete & Kautionsübergang',
    triggerKeywords: ['miete', 'mietvertrag', 'vermietet', 'kaution', 'mietverhaeltnisse'],
    isGlobal: false,
    instruction:
      'Der Erwerber tritt gem. § 566 BGB kraft Gesetzes in bestehende Mietverträge ein. Liegen nur geschwärzte Mietlisten oder keine Belege über Kautionskonten (§ 566a BGB) vor, ist das Feld mietverhaeltnisse auf NEEDS_REVIEW zu setzen.',
    suggestedAction:
      'Vollständige Mietverträge und Nachweise über Barkautionen/Bürgschaften anfordern.',
  },
];
