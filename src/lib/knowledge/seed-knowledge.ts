import { KNOWLEDGE_CATEGORIES, KnowledgeDocument } from '@/types/knowledge';

/**
 * Standardmäßige, juristisch validierte Wissensbasis für DNotI-Gutachten und Amtsgerichts-Praxis.
 * Steht allen Kanzleien global zur Verfügung (organizationId: null).
 */
export const GLOBAL_NOTARY_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'd0000001-0000-4000-8000-000000000001',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN,
    legalBasis: 'DNotI-Report 2023/18 (MoPeG)',
    courtOrAuthority: 'Deutsches Notarinstitut (DNotI)',
    title: 'Voreintragung der eGbR im Gesellschaftsregister (§ 47 Abs. 2 GBO n.F.)',
    content:
      'Seit dem 01.01.2024 (MoPeG) kann eine Gesellschaft bürgerlichen Rechts (GbR) über ein im Grundbuch eingetragenes Recht nur verfügen oder ein Recht erwerben, wenn sie zuvor im Gesellschaftsregister eingetragen und sodann im Grundbuch als "eGbR" berichtigt ist.',
    triggerKeywords: ['gbr', 'mopeg', 'voreintragung', 'gesellschaftsregister', 'egbr'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd0000001-0000-4000-8000-000000000002',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
    legalBasis: '§ 12 HGB / AG Hamburg Az. 14 HRB',
    courtOrAuthority: 'Amtsgericht Hamburg (Registergericht)',
    title: 'Aktualität von Handelsregisterauszügen bei Vertretungshandlungen',
    content:
      'Wird bei der Veräußerung oder Belastung einer Liegenschaft eine juristische Person (GmbH, UG, AG, KG) vertreten, verlangt das Registergericht sowie das Grundbuchamt Hamburg zwingend den Nachweis der Vertretungsmacht durch einen tagesaktuellen (maximal 14 Tage alten) beglaubigten Registerauszug.',
    triggerKeywords: ['gmbh', 'ug', 'kg', 'ag', 'hamburg', 'registerauszug', 'vertretungsmacht'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd0000001-0000-4000-8000-000000000003',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN,
    legalBasis: 'DNotI-Gutachten Dok.-Nr. 184592 (§ 144 BauGB)',
    courtOrAuthority: 'Deutsches Notarinstitut (DNotI)',
    title: 'Genehmigungspflicht bei Sanierungs- und Entwicklungsvermerken',
    content:
      'Befindet sich das Flurstück in einem förmlich festgelegten Sanierungsgebiet (§ 142 BauGB), bedarf der Kaufvertrag sowie die Auflassung der schriftlichen Genehmigung der Gemeinde gem. § 144 Abs. 2 BauGB vor Vollzug.',
    triggerKeywords: ['sanierungsvermerk', 'entwicklungsvermerk', 'baugb', 'gemeindegenehmigung'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd0000001-0000-4000-8000-000000000004',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
    legalBasis: '§ 35 GBO / OLG München 34 Wx',
    courtOrAuthority: 'OLG München / AG München (Grundbuchamt)',
    title: 'Erbnachweis bei unberichtigtem Grundbuch',
    content:
      'Ist im Grundbuch noch der Erblasser eingetragen, kann der Nachweis der Erbfolge gegenüber dem Grundbuchamt nur durch Erbschein oder europäisches Nachlasszeugnis bzw. notarielles Testament mit Eröffnungsprotokoll geführt werden (§ 35 Abs. 1 GBO).',
    triggerKeywords: ['erblasser', 'erbschein', 'erbfall', 'testament', 'nachlass'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
