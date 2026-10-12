import { KnowledgeDocument, KNOWLEDGE_CATEGORIES } from '@/types/knowledge';

/**
 * 35 kuratierte notarielle Wissensdokumente für den Retrieval-Benchmark.
 * Deckt Kerngebiete (Immobilienkauf, GBO, MoPeG, WEG, MaBV, GmbH, Erbrecht, Notaranderkonto)
 * sowie realistische Distraktoren (Gewerbemiete, Baunutzung, Maklerrecht) ab.
 */
export const BENCHMARK_KNOWLEDGE_CORPUS: KnowledgeDocument[] = [
  // 1. GEG Energieausweis
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 80 Abs. 2 GEG',
    courtOrAuthority: 'Gebäudeenergiegesetz',
    title: 'Gültigkeit von Energieausweisen (10 Jahre)',
    content:
      'Energieausweise sind gem. § 80 Abs. 2 GEG genau 10 Jahre ab Ausstellungsdatum gültig. Liegt das Ablaufdatum vor dem Bearbeitungsstichtag, muss der Ausweis als abgelaufen eingestuft werden.',
    triggerKeywords: ['energieausweis', 'bedarfsausweis', 'verbrauchsausweis', 'geg'],
    isGlobal: true,
    suggestedAction: 'Aktuellen Energieausweis beim Verkäufer oder Eigentümer anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 2. Grundbuchstand & Amtliche Einsicht
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 21 BeurkG',
    courtOrAuthority: 'Beurkundungsgesetz',
    title: 'Grundbuchstand & Amtliche Einsicht',
    content:
      'Grundbuchauszüge verfallen nicht kalendarisch und belegen den Aktenstand. Unmittelbar vor Beurkundung ist jedoch eine amtliche Grundbucheinsicht gem. § 21 BeurkG durch das Notariat zu dokumentieren.',
    triggerKeywords: ['grundbuch', 'grundbuchauszug', 'blatt', 'bestandsverzeichnis'],
    isGlobal: true,
    suggestedAction: 'Amtliche Grundbucheinsicht unmittelbar vor dem Beurkundungstermin vornehmen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 3. MoPeG / eGbR-Voreintragungspflicht
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 707 BGB, § 47 Abs. 2 GBO',
    courtOrAuthority: 'MoPeG / Grundbuchordnung',
    title: 'eGbR-Voreintragungspflicht bei Immobiliengeschäften',
    content:
      'Seit Inkrafttreten des MoPeG muss eine rechtsfähige GbR im Gesellschaftsregister (eGbR) eingetragen sein, um im Grundbuch als Eigentümerin eingetragen zu werden oder über ein Grundstück zu verfügen (§ 47 Abs. 2 GBO). Registerauszug (GsR) und Namenszusatz eGbR sind zwingend.',
    triggerKeywords: [
      'gbr',
      'gesellschaft bürgerlichen rechts',
      'egbr',
      'mopeg',
      'gesellschaftsregister',
    ],
    isGlobal: false,
    suggestedAction: 'Eintragungsnachweis aus dem Gesellschaftsregister (eGbR) zur Akte anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 4. Handelsregister Vertretungsnachweis
  {
    id: 'd0000000-0000-4000-8000-000000000004',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 12 HGB, § 21 BNotO',
    courtOrAuthority: 'Handelsgesetzbuch',
    title: 'Vertretungsnachweis juristischer Personen & HRB-Einsicht',
    content:
      'Handelsregisterauszüge (HRB / HRA) für beteiligte Gesellschaften dokumentieren die Vertretungsmacht von Geschäftsführern und Prokuristen. Der Notar bescheinigt die Vertretungsberechtigung nach elektronischer Registereinsicht gem. § 21 Abs. 1 BNotO.',
    triggerKeywords: ['handelsregister', 'hrb', 'hra', 'amtsgericht', 'geschäftsführer', 'prokura'],
    isGlobal: false,
    suggestedAction: 'Elektronische Einsichtnahme ins Handelsregister gem. § 21 BNotO durchführen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 5. MaBV Ratenplan & Bauträgervertrag
  {
    id: 'd0000000-0000-4000-8000-000000000005',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 3 MaBV, § 650u BGB',
    courtOrAuthority: 'Makler- und Bauträgerverordnung',
    title: 'MaBV-Ratenplan bei Bauträgerverträgen',
    content:
      'Bei Verträgen mit Bauverpflichtung dürfen Zahlungen des Erwerbers nur nach Baufortschritt in maximal 7 Raten gem. § 3 Abs. 2 MaBV vereinbart werden. Vorzeitige Fälligkeiten oder abweichende Ratenquoten sind unwirksam.',
    triggerKeywords: [
      'mabv',
      'bauträger',
      'baufortschritt',
      'ratenplan',
      'rohbau',
      'fertigstellung',
    ],
    isGlobal: false,
    suggestedAction:
      'Ratenplan auf Einhaltung der gesetzlichen Höchstsätze nach § 3 Abs. 2 MaBV prüfen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 6. Mietverhältnisse & § 566 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000006',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 566, § 566a BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Übergang von Wohnraummietverhältnissen (Kauf bricht nicht Miete)',
    content:
      'Wird vermieteter Wohnraum veräußert, tritt der Erwerber mit Eigentumsumschreibung kraft Gesetzes in die Vermieterrechte und -pflichten ein (§ 566 BGB). Mietkautionen sind gem. § 566a BGB abzurechnen und im Vertrag zu regeln.',
    triggerKeywords: ['mietvertrag', 'miete', 'mieter', 'kaution', 'vermietet', 'wohnraum'],
    isGlobal: false,
    suggestedAction: 'Klausel zur Kautionsübergabe und Lastenübergang im Kaufvertrag aufnehmen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 7. Sanierungsvermerk & § 144 BauGB
  {
    id: 'd0000000-0000-4000-8000-000000000007',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 144, § 145 BauGB',
    courtOrAuthority: 'Baugesetzbuch',
    title: 'Sanierungsvermerk & Genehmigungspflicht nach § 144 BauGB',
    content:
      'Ist im Grundbuch in Abteilung II ein Sanierungsvermerk eingetragen, bedürfen der schuldrechtliche Kaufvertrag und die dingliche Auflassung der schriftlichen Genehmigung der Sanierungsbehörde/Gemeinde gem. § 144 Abs. 1 BauGB.',
    triggerKeywords: ['sanierungsvermerk', 'sanierungsgebiet', 'baugb', 'gemeindegenehmigung'],
    isGlobal: false,
    suggestedAction: 'Sanierungsgenehmigung bei der zuständigen Gemeinde beantragen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 8. Gesetzliches Vorkaufsrecht der Gemeinde § 24 BauGB
  {
    id: 'd0000000-0000-4000-8000-000000000008',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 24, § 28 BauGB',
    courtOrAuthority: 'Baugesetzbuch',
    title: 'Gesetzliches Vorkaufsrecht der Gemeinde (Negativattest)',
    content:
      'Beim Verkauf von Grundstücken steht der Gemeinde unter den Voraussetzungen des § 24 BauGB ein gesetzliches Vorkaufsrecht zu. Zur Eigentumsumschreibung im Grundbuch ist ein Negativattest (§ 28 Abs. 1 BauGB) oder der Verzicht erforderlich.',
    triggerKeywords: ['vorkaufsrecht', 'negativattest', 'gemeinde', 'baugb', 'zeugnis'],
    isGlobal: true,
    suggestedAction:
      'Negativzeugnis über Nichtbestehen/Nichtausübung des gemeindlichen Vorkaufsrechts anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 9. Grundstückverkehrsgesetz Genehmigung § 2 GrdstVG
  {
    id: 'd0000000-0000-4000-8000-000000000009',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 2 GrdstVG',
    courtOrAuthority: 'Grundstückverkehrsgesetz',
    title: 'Genehmigungspflicht land- und forstwirtschaftlicher Grundstücke',
    content:
      'Die Veräußerung von land- oder forstwirtschaftlichen Flächen ab einer landesrechtlichen Freigrenze bedarf der Genehmigung nach § 2 GrdstVG. Ohne die Genehmigung ist der Vertrag schwebend unwirksam.',
    triggerKeywords: ['grdstvg', 'landwirtschaft', 'forstwirtschaft', 'ackerland', 'wald'],
    isGlobal: false,
    suggestedAction:
      'Genehmigung nach Grundstückverkehrsgesetz bei der Landwirtschaftsbehörde einholen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 10. WEG Verwalterzustimmung § 12 WEG
  {
    id: 'd0000000-0000-4000-8000-000000000010',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 12 WEG',
    courtOrAuthority: 'Wohnungseigentumsgesetz',
    title: 'Verwalterzustimmung bei Veräußerung von Wohnungseigentum',
    content:
      'Ist in der Teilungserklärung als Inhalt des Sondereigentums vereinbart, dass zur Veräußerung die Zustimmung des Verwalters erforderlich ist (§ 12 Abs. 1 WEG), bedarf die Zustimmung der notariellen Beglaubigung nebst Nachweis der Verwalterbestellung.',
    triggerKeywords: [
      'wohnungseigentum',
      'weg',
      'verwalter',
      'verwalterzustimmung',
      'teilungserklärung',
      'sondereigentum',
    ],
    isGlobal: false,
    suggestedAction:
      'Öffentlich beglaubigte Verwalterzustimmung samt Verwalterprotokoll anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 11. Identitätsfeststellung & Geldwäschegesetz § 10 GwG
  {
    id: 'd0000000-0000-4000-8000-000000000011',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 10, § 11 GwG, § 10 BeurkG',
    courtOrAuthority: 'Geldwäschegesetz / BNotO',
    title: 'Geldwäscherechtliche Identifizierung & Transparenzregister',
    content:
      'Notare sind Verpflichtete nach dem Geldwäschegesetz. Alle Beteiligten müssen vor Beurkundung anhand gültiger Ausweisdokumente identifiziert werden. Bei Gesellschaften ist zwingend ein Auszug aus dem Transparenzregister einzuholen.',
    triggerKeywords: [
      'gwg',
      'geldwäsche',
      'transparenzregister',
      'wirtschaftlich berechtigter',
      'ausweis',
    ],
    isGlobal: true,
    suggestedAction: 'Ausweiskopien und Transparenzregisterauszug zur Akte nehmen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 12. Notaranderkonto Dienstordnung § 54a BeurkG
  {
    id: 'd0000000-0000-4000-8000-000000000012',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 54a BeurkG, § 57 DONot',
    courtOrAuthority: 'Beurkundungsgesetz / Dienstordnung',
    title: 'Voraussetzungen für die Verwahrung auf Notaranderkonto',
    content:
      'Die Verwahrung von Kaufpreisgeldern auf einem Notaranderkonto ist nur bei Vorliegen eines berechtigten Sicherungsinteresses zulässig (§ 54a Abs. 2 BeurkG). Die Direktzahlung mit Auflassungsvormerkung ist der Regelfall.',
    triggerKeywords: ['notaranderkonto', 'anderkonto', 'verwahrung', 'treuhand', 'auszahlung'],
    isGlobal: false,
    suggestedAction: 'Berechtigtes Sicherungsinteresse in der Urkunde ausdrücklich begründen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 13. Auflassungsvormerkung § 883 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000013',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 883, § 885 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Sicherung des Eigentumserwerbs durch Auflassungsvormerkung',
    content:
      'Zur Sicherung des Anspruchs auf Eigentumsübertragung ist zugunsten des Käufers eine Vormerkung im Grundbuch einzutragen (§ 883 BGB). Erst nach Bestätigung der Vormerkungseintragung darf der Kaufpreis fällig gestellt werden.',
    triggerKeywords: ['vormerkung', 'auflassungsvormerkung', 'abteilung ii', 'sicherung'],
    isGlobal: true,
    suggestedAction:
      'Vormerkungsantrag unverzüglich nach Beurkundung beim Grundbuchamt einreichen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 14. Löschung Grundpfandrechte § 875 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000014',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 875 BGB, § 27 GBO',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Lastenfreistellung von Grundschulden und Hypotheken',
    content:
      'Zur lastenfreien Eigentumsübertragung fordert der Notar Löschungsbewilligungen der Grundpfandgläubiger nebst Treuhandauflagen zur Ablösung der Valuta aus dem Kaufpreis an (§ 875 BGB).',
    triggerKeywords: [
      'grundschuld',
      'hypothek',
      'löschungsbewilligung',
      'treuhandauftrag',
      'abteilung iii',
      'ablösung',
    ],
    isGlobal: false,
    suggestedAction: 'Löschungsunterlagen bei der finanzierenden Bank anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 15. Belastungsvollmacht
  {
    id: 'd0000000-0000-4000-8000-000000000015',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
    legalBasis: 'Kanzleirichtlinie Belastungsvollmacht, DNotI-Report 2021/11',
    courtOrAuthority: 'DNotI / Notarkammer',
    title: 'Standard-Belastungsvollmacht mit Treuhandbindung',
    content:
      'Verkäufer bevollmächtigen Käufer, das Grundstück vor Eigentumsumschreibung mit Grundpfandrechten zur Finanzierung zu belasten. Die Vollmacht muss zwingend die Abtretung der Darlehensauszahlung an den Verkäufer vorsehen.',
    triggerKeywords: ['belastungsvollmacht', 'finanzierungsvollmacht', 'grundschuldbestellung'],
    isGlobal: false,
    suggestedAction: 'Sicherungsabrede in der Grundschuldbestellungsurkunde verankern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 16. Erbengemeinschaft Verfügung § 2040 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000016',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 2040 BGB, § 35 GBO',
    courtOrAuthority: 'Bürgerliches Gesetzbuch / Erbrecht',
    title: 'Gesamthänderische Verfügung einer Erbengemeinschaft',
    content:
      'Die Miterben einer Erbengemeinschaft können über einen Nachlassgegenstand (z.B. Grundstück) nur gemeinschaftlich verfügen (§ 2040 Abs. 1 BGB). Der Nachweis der Erbfolge erfolgt durch Erbschein oder notarielles Testament nebst Eröffnungsniederschrift.',
    triggerKeywords: ['erbengemeinschaft', 'erbe', 'miterbe', 'erbschein', 'testament', 'nachlass'],
    isGlobal: false,
    suggestedAction: 'Erbschein oder eröffnetes notarielles Testament als Erbnachweis anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 17. Betreuungsgerichtliche Genehmigung § 1850 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000017',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 1850 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch / Betreuungsrecht',
    title: 'Genehmigung des Betreuungsgerichts bei Grundstücksgeschäften',
    content:
      'Handelt ein gesetzlicher Betreuer für einen Beteiligten bei der Veräußerung oder dem Erwerb eines Grundstücks, bedarf der Vertrag der Genehmigung des Betreuungsgerichts (§ 1850 BGB n.F.). Bis zur rechtskräftigen Genehmigung ist der Vertrag schwebend unwirksam.',
    triggerKeywords: ['betreuer', 'betreuung', 'betreuungsgericht', 'genehmigung', 'beschluss'],
    isGlobal: false,
    suggestedAction:
      'Betreuungsgerichtliche Genehmigung einholen und Rechtskraftzeugnis anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 18. Familiengerichtliche Genehmigung Minderjährige § 1643 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000018',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 1643, § 1850 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch / Familienrecht',
    title: 'Familiengerichtliche Genehmigung bei minderjährigen Beteiligten',
    content:
      'Verträge, durch die ein minderjähriges Kind ein Grundstück veräußert oder erwirbt, bedürfen der Genehmigung des Familiengerichts (§ 1643 Abs. 1 i.V.m. § 1850 BGB), es sei denn, es handelt sich um ein lediglich rechtlich vorteilhaftes Geschäft.',
    triggerKeywords: ['minderjährig', 'kind', 'eltern', 'familiengericht', 'ergänzungspfleger'],
    isGlobal: false,
    suggestedAction: 'Familiengerichtliche Genehmigung über das Familiengericht beantragen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 19. Wohnungsbauförderung & Nachbindungen
  {
    id: 'd0000000-0000-4000-8000-000000000019',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 13 WoBindG',
    courtOrAuthority: 'Wohnungsbindungsgesetz',
    title: 'Preisbindung und Belegungsrechte bei öffentlich gefördertem Wohnraum',
    content:
      'Bei geförderten Wohnungen (Sozialwohnungen) bestehen gesetzliche Mietpreis- und Belegungsbindungen nach dem Wohnungsbindungsgesetz. Der Erwerber übernimmt diese Bindungen kraft Gesetzes.',
    triggerKeywords: ['sozialwohnung', 'wobindg', 'belegungsrecht', 'förderung', 'preisbindung'],
    isGlobal: false,
    suggestedAction: 'Bescheinigung der Wohnungsbauförderungsanstalt zur Bindungsdauer anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 20. Denkmalschutzrechtliche Genehmigung
  {
    id: 'd0000000-0000-4000-8000-000000000020',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
    legalBasis: 'Landesdenkmalschutzgesetze (z.B. § 9 DSchG)',
    courtOrAuthority: 'Denkmalschutzbehörde',
    title: 'Denkmalschutz & Vorkaufsrecht nach Denkmalschutzgesetz',
    content:
      'Steht das Veräußerungsobjekt unter Denkmalschutz, ist im Kaufvertrag auf die denkmalrechtlichen Erhaltungs- und Genehmigungspflichten hinzuweisen. In einigen Bundesländern besteht ein gesondertes Vorkaufsrecht.',
    triggerKeywords: ['denkmal', 'denkmalschutz', 'denkmalliste', 'erhaltungssatzung'],
    isGlobal: false,
    suggestedAction: 'Auskunft aus dem Denkmalverzeichnis bei der Denkmalschutzbehörde beiziehen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 21. Baulastenverzeichnis Einsicht
  {
    id: 'd0000000-0000-4000-8000-000000000021',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
    legalBasis: 'Kanzleirichtlinie Baulasten, BauO der Länder',
    courtOrAuthority: 'Bauaufsichtsamt',
    title: 'Einsicht in das Baulastenverzeichnis',
    content:
      'Öffentlich-rechtliche Baulasten (z.B. Abstandsflächenbaulasten, Geh-, Fahr- und Leitungsrechte) werden nicht im Grundbuch eingetragen. Der Notar klärt die Parteien über das gesonderte Baulastenverzeichnis auf.',
    triggerKeywords: ['baulast', 'baulastenverzeichnis', 'abstandsfläche', 'bauaufsicht'],
    isGlobal: true,
    suggestedAction: 'Baulastenauskunft bei der zuständigen Bauaufsichtsbehörde beantragen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 22. Notarkosten & GNotKG Fälligkeit § 10 GNotKG
  {
    id: 'd0000000-0000-4000-8000-000000000022',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 10, § 29, § 30 GNotKG',
    courtOrAuthority: 'Gerichts- und Notarkostengesetz',
    title: 'Kostenschuldner und Gesamtschuldnerschaft nach GNotKG',
    content:
      'Kostenschuldner der notariellen Beurkundung sind alle Antragsteller und die Personen, in deren Interesse das Geschäft beurkundet wird. Im Außenverhältnis zum Notar haften Käufer und Verkäufer als Gesamtschuldner (§ 29, § 30 GNotKG).',
    triggerKeywords: ['notarkosten', 'gnotkg', 'kostenrechnung', 'gesamtschuldner'],
    isGlobal: false,
    suggestedAction: 'Kostenregelung im Innenverhältnis im Kaufvertrag klar festlegen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 23. Grunderwerbsteuer Unbedenklichkeitsbescheinigung § 22 GrEStG
  {
    id: 'd0000000-0000-4000-8000-000000000023',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 22 GrEStG',
    courtOrAuthority: 'Grunderwerbsteuergesetz',
    title: 'Unbedenklichkeitsbescheinigung des Finanzamts (UB)',
    content:
      'Das Grundbuchamt darf den Erwerber erst als Eigentümer eintragen, wenn die Unbedenklichkeitsbescheinigung des zuständigen Finanzamts vorliegt (§ 22 Abs. 1 GrEStG). Der Notar zeigt den Kaufvertrag unverzüglich dem Finanzamt an (§ 18 GrEStG).',
    triggerKeywords: [
      'grunderwerbsteuer',
      'unbedenklichkeitsbescheinigung',
      'ub',
      'finanzamt',
      'grestg',
    ],
    isGlobal: true,
    suggestedAction:
      'Veräußerungsanzeige unverzüglich nach Beurkundung an das Finanzamt versenden.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 24. GmbH Gründung Musterprotokoll § 2 Abs. 1a GmbHG
  {
    id: 'd0000000-0000-4000-8000-000000000024',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 2 Abs. 1a GmbHG',
    courtOrAuthority: 'Gesetz betreffend die Gesellschaften mit beschränkter Haftung',
    title: 'GmbH-Gründung im vereinfachten Verfahren (Musterprotokoll)',
    content:
      'Eine GmbH mit höchstens drei Gesellschaftern und einem Geschäftsführer kann unter Verwendung des gesetzlichen Musterprotokolls gegründet werden. Sachgründungen oder abweichende Satzungsregelungen sind ausgeschlossen.',
    triggerKeywords: ['musterprotokoll', 'gmbh', 'bargründung', 'stammkapital', 'stammeinlage'],
    isGlobal: false,
    suggestedAction: 'Auf zulässige Bareinzahlung und maximal 3 Gesellschafter hinweisen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 25. GmbH Mindesteinzahlung Stammkapital § 7 Abs. 2 GmbHG
  {
    id: 'd0000000-0000-4000-8000-000000000025',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 7 Abs. 2, § 8 Abs. 2 GmbHG',
    courtOrAuthority: 'GmbHG',
    title: 'Mindesteinzahlung vor Handelsregisteranmeldung',
    content:
      'Auf jeden Geschäftsanteil muss mindestens ein Viertel des Nennbetrags eingezahlt sein. Insgesamt müssen mindestens 12.500 Euro vor Anmeldung zum Handelsregister zur freien Verfügung der Geschäftsführer eingezahlt sein.',
    triggerKeywords: [
      'stammkapital',
      'mindesteinzahlung',
      '12500',
      'handelsregisteranmeldung',
      'gmbh',
    ],
    isGlobal: false,
    suggestedAction: 'Bankbestätigung über Bareinzahlung des Stammkapitals anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 26. Vollmachtsnachweis § 172 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000026',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 172 BGB, § 29 GBO',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Vollmachtsvorlage in Urschrift oder Ausfertigung',
    content:
      'Tritt ein Vertreter auf, muss dem Notar und dem Grundbuchamt die Vollmacht in Ausfertigung oder Urschrift in öffentlich beglaubigter Form vorliegen (§ 172 BGB, § 29 GBO). Eine einfache Kopie genügt nicht.',
    triggerKeywords: ['vollmacht', 'urschrift', 'ausfertigung', 'vertreter', 'beglaubigt'],
    isGlobal: true,
    suggestedAction: 'Notarielle Vollmachtsausfertigung im Original zur Urkunde beiziehen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 27. Nachgenehmigung vollmachtloser Vertreter § 177 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000027',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 177, § 182 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Genehmigung des vollmachtlos Vertretenen',
    content:
      'Wird ein Vertrag durch einen Vertreter ohne Vertretungsmacht geschlossen, hängt die Wirksamkeit von der Genehmigung des Vertretenen ab. Für das Grundbuchamt ist die Genehmigungserklärung in notariell beglaubigter Form erforderlich (§ 29 GBO).',
    triggerKeywords: ['vollmachtlos', 'nachgenehmigung', 'genehmigungserklärung', 'genehmigung'],
    isGlobal: false,
    suggestedAction:
      'Genehmigungserklärung zur notariellen Beglaubigung an den Vertretenen übersenden.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 28. DNotI Gutachten Flurstücksverschmelzung
  {
    id: 'd0000000-0000-4000-8000-000000000028',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN,
    legalBasis: 'DNotI-Report 2022/19, § 890 BGB',
    courtOrAuthority: 'Deutsches Notarinstitut (DNotI)',
    title: 'Grundstücksvereinigung und Belastungsgleichstand',
    content:
      'Mehrere Flurstücke können nach § 890 BGB zu einem Grundstück vereinigt werden. Voraussetzung für die katasterliche und grundbuchliche Vereinigung ist jedoch die Verwirrungsgrundsatz-Prüfung und Belastungsgleichheit in Abt. III.',
    triggerKeywords: [
      'flurstück',
      'verschmelzung',
      'vereinigung',
      'flur',
      'parzelle',
      'belastungsgleichstand',
    ],
    isGlobal: false,
    suggestedAction: 'Belastungsgleichstand vor Vereinigungsantrag beim Grundbuchamt herbeiführen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 29. DNotI Gutachten Teilflächenkauf & Vermessung
  {
    id: 'd0000000-0000-4000-8000-000000000029',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN,
    legalBasis: 'DNotI-Report 2020/04, § 2 Abs. 3 GBO',
    courtOrAuthority: 'Deutsches Notarinstitut (DNotI)',
    title: 'Verkauf unvermessener Teilflächen & Bestimmtheitsgrundsatz',
    content:
      'Wird eine noch nicht vermessene Teilfläche eines Flurstücks verkauft, verlangt der Bestimmtheitsgrundsatz eine eindeutige kartographische Abgrenzung in einem der Urkunde beigefügten amtlichen Lageplan (§ 9 BeurkG). Die Auflassung kann erst nach Vorliegen des amtlichen Fortführungsnachweises (Katasteramt) erklärt werden.',
    triggerKeywords: [
      'teilfläche',
      'vermessung',
      'fortführungsnachweis',
      'katasteramt',
      'flurstückzerlegung',
    ],
    isGlobal: false,
    suggestedAction:
      'Amtlichen Lageplan mit maßstäblicher Markierung der Teilfläche als Urkundenanlage beifügen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 30. Wegerecht und Dienstbarkeiten § 1018 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000030',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 1018 BGB, § 1020 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Grunddienstbarkeit (Geh- und Fahrrecht, Leitungsrecht)',
    content:
      'Eine Grunddienstbarkeit berechtigt den jeweiligen Eigentümer des herrschenden Grundstücks zur Mitbenutzung des dienenden Grundstücks. Bei der Bestellung ist der Ausübungsbereich genau zu bezeichnen und eine Unterhaltungsregelung zu treffen.',
    triggerKeywords: [
      'grunddienstbarkeit',
      'wegerecht',
      'gehrecht',
      'fahrrecht',
      'leitungsrecht',
      'dienstbarkeit',
    ],
    isGlobal: false,
    suggestedAction: 'Dienstbarkeitsbewilligung mit Lageplan und Kostenregelung aufnehmen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 31. Distraktor: Gewerberaum-Kündigungsfrist § 580a BGB
  {
    id: 'd0000000-0000-4000-8000-000000000031',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 580a Abs. 2 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Kündigungsfristen bei Geschäftsraummiete (Distraktor)',
    content:
      'Bei Mietverhältnissen über Geschäftsräume ist die ordentliche Kündigung spätestens am dritten Werktag eines Kalendervierteljahres zum Ablauf des nächsten Kalendervierteljahres zulässig.',
    triggerKeywords: ['geschäftsraummiete', 'gewerberaum', 'kündigungsfrist', 'quartal'],
    isGlobal: false,
    suggestedAction: 'Keine notarielle Relevanz für Kaufvertragsabwicklung.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 32. Distraktor: Maklerprovision § 656c BGB
  {
    id: 'd0000000-0000-4000-8000-000000000032',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 656c, § 656d BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Halbteilung der Maklerprovision bei Einfamilienhaus (Distraktor)',
    content:
      'Schließt der Makler einen Maklervertrag mit beiden Parteien ab, kann er eine Vergütung nur von beiden Parteien zu gleichen Teilen verlangen. Vereinbarungen mit abweichender Provisionsverteilung sind unwirksam.',
    triggerKeywords: ['makler', 'maklerprovision', 'courtage', 'maklervertrag', 'halbteilung'],
    isGlobal: false,
    suggestedAction: 'Reine Maklerklausel dient nur deklaratorischer Klarstellung.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 33. Distraktor: Baunutzungsverordnung GRZ/GFZ § 16 BauNVO
  {
    id: 'd0000000-0000-4000-8000-000000000033',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 16, § 17 BauNVO',
    courtOrAuthority: 'Baunutzungsverordnung',
    title: 'Maß der baulichen Nutzung (GRZ / GFZ) (Distraktor)',
    content:
      'Die Grundflächenzahl gibt an, wie viel Quadratmeter Grundfläche je Quadratmeter Grundstücksfläche baulich genutzt werden dürfen. Die Geschossflächenzahl bestimmt die Vollgeschossfläche.',
    triggerKeywords: ['baunvo', 'grz', 'gfz', 'grundflächenzahl', 'bebauungsplan'],
    isGlobal: false,
    suggestedAction: 'Immobilienbewertungssache, kein Vollzugshindernis für Grundbuchamt.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 34. Distraktor: Nachlassinsolvenz § 315 InsO
  {
    id: 'd0000000-0000-4000-8000-000000000034',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 315 InsO',
    courtOrAuthority: 'Insolvenzordnung',
    title: 'Eröffnung des Nachlassinsolvenzverfahrens (Distraktor)',
    content:
      'Ist der Nachlass überschuldet oder zahlungsunfähig, hat der Erbe unverzüglich die Eröffnung des Nachlassinsolvenzverfahrens zu beantragen, um seine eigene Haftung auf den Nachlass zu beschränken.',
    triggerKeywords: ['nachlassinsolvenz', 'überschuldung', 'inso', 'nachlassverwaltung'],
    isGlobal: false,
    suggestedAction: 'Insolvenzrechtliche Beratung empfehlen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  // 35. BGB Kaufvertragliche Sachmängelhaftung § 444 BGB
  {
    id: 'd0000000-0000-4000-8000-000000000035',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 434, § 442, § 444 BGB',
    courtOrAuthority: 'Bürgerliches Gesetzbuch',
    title: 'Sachmängelgewährleistungsausschluss bei Bestandsimmobilien',
    content:
      'Beim Kauf gebrauchter Immobilien wird in der Praxis die Haftung für Sachmängel ausgeschlossen (gekauft wie gesehen). Auf diesen Ausschluss kann sich der Verkäufer nicht berufen, wenn er den Mangel arglistig verschwiegen hat (§ 444 BGB).',
    triggerKeywords: [
      'sachmängelhaftung',
      'gewährleistung',
      'gewährleistungsausschluss',
      'arglist',
      'mängel',
    ],
    isGlobal: true,
    suggestedAction: 'Standardmäßigen Haftungsausschluss mit Belehrung über Arglist aufnehmen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
