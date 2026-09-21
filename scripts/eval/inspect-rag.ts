import { InMemoryKnowledgeRepository } from '@/lib/in-memory/in-memory-knowledge-repository';
import {
  formatKnowledgeForPrompt,
  selectApplicableKnowledge,
} from '@/lib/knowledge/rules/rule-selector';
import { CASE_TYPES } from '@/types/dossier';
import { KNOWLEDGE_CATEGORIES, KnowledgeDocument } from '@/types/knowledge';

// Lokale Fixtures zur reinen Offline-Inspektion der Matching-Algorithmen
const INSPECTION_FIXTURES: KnowledgeDocument[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 80 Abs. 2 GEG',
    title: 'Gültigkeit von Energieausweisen (10 Jahre)',
    content:
      'Energieausweise sind gem. § 80 Abs. 2 GEG genau 10 Jahre ab Ausstellungsdatum gültig. Liegt das Ablaufdatum vor dem Bearbeitungsstichtag, MUSS das Feld als OUTDATED (isExpired: true) markiert werden.',
    triggerKeywords: ['energieausweis', 'bedarfsausweis', 'verbrauchsausweis'],
    isGlobal: true,
    suggestedAction: 'Aktuellen Energieausweis beim Verkäufer oder Eigentümer anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 21 BeurkG',
    title: 'Grundbuchstand & Amtliche Einsicht',
    content:
      'Grundbuchauszüge verfallen nicht kalendarisch und belegen den Aktenstand (VERIFIED). Liegt das Auszugsdatum länger zurück, ist ein neutraler Hinweis auf die vor Beurkundung erforderliche amtliche Grundbucheinsicht gem. § 21 BeurkG in note zu vermerken.',
    triggerKeywords: ['grundbuch', 'grundbuchauszug', 'blatt'],
    isGlobal: true,
    suggestedAction: 'Amtliche Grundbucheinsicht unmittelbar vor dem Beurkundungstermin vornehmen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 707 BGB, § 47 Abs. 2 GBO n.F. (MoPeG)',
    title: 'eGbR-Voreintragungspflicht bei Immobiliengeschäften',
    content:
      'Seit Inkrafttreten des MoPeG muss eine rechtsfähige GbR im neuen Gesellschaftsregister (eGbR) eingetragen sein, um im Grundbuch als Eigentümerin eingetragen zu werden oder über ein Grundstück zu verfügen (§ 47 Abs. 2 GBO). Fehlt der Registerauszug (GsR) oder der Namenszusatz "eGbR", ist das Feld auf NEEDS_REVIEW zu setzen und ein Nachweis der Eintragung nachzufordern.',
    triggerKeywords: ['gbr', 'gesellschaft bürgerlichen rechts', 'egbr'],
    isGlobal: false,
    suggestedAction: 'Eintragungsnachweis aus dem Gesellschaftsregister (eGbR) zur Akte anfordern.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000004',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 12 HGB, § 21 BNotO',
    title: 'Vertretungsnachweis juristischer Personen',
    content:
      'Bei eingetragenen Handelsgesellschaften (GmbH, UG, AG, KG, OHG) muss ein amtlicher Handelsregisterauszug vorliegen und die Vertretungsbefugnis (Einzel- vs. Gesamtvertretung) feststehen. Fehlt der Registerauszug, ist das Feld auf NEEDS_REVIEW zu setzen und eine gezielte Nachforderung (inquiry) zu stellen.',
    triggerKeywords: ['gmbh', 'ug', 'ag', 'kg', 'ohg', 'gmbh & co'],
    isGlobal: false,
    suggestedAction:
      'Handelsregisterauszug (HRB/HRA) amtlich abrufen oder vom Beteiligten einreichen lassen.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
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
    isGlobal: false,
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
    isGlobal: false,
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
    isGlobal: false,
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
    isGlobal: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

async function runRagInspection() {
  const repo = new InMemoryKnowledgeRepository(INSPECTION_FIXTURES);

  console.log('='.repeat(80));
  console.log('🔍 NOTARPARTNER RAG-INSPEKTION & TOKEN-ANALYSE (DATABASE-FIRST SSOT)');
  console.log('='.repeat(80));
  console.log('Kosten für diese Inspektion: 0,00 € (reine deterministische Offline-Auswertung)\n');

  const scenarios = [
    {
      name: 'Szenario 1: Immobilienkauf mit einer Gesellschaft bürgerlichen Rechts (GbR)',
      description:
        'Mandant reicht Kaufvertrag ein, Verkäufer ist eine GbR ("Müller & Partner GbR").',
      context: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        fields: {
          verkaeufer: {
            data: {
              parties: [{ name: 'Müller & Partner GbR', legalForm: 'GbR' }],
            },
          },
          kaufpreis: {
            data: { amount: 450000 },
          },
        },
        detectedDocuments: [{ fileName: 'Kaufvertragsentwurf.pdf', documentType: 'VERTRAG' }],
        notes: 'Verkäufer tritt als GbR auf.',
      },
    },
    {
      name: 'Szenario 2: Gewerbeobjekt mit GmbH-Käufer & Sanierungsvermerk',
      description: 'Käufer ist eine GmbH. In den Grundbuch-Notizen steht ein Sanierungsvermerk.',
      context: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        fields: {
          kaeufer: {
            data: { name: 'NordInvest Real Estate GmbH', legalForm: 'GmbH' },
          },
          grundbuch: {
            data: { belastungen: 'Abteilung II: Sanierungsvermerk gem. BauGB' },
          },
        },
        detectedDocuments: [
          { fileName: 'Grundbuchauszug_Hamburg.pdf', documentType: 'GRUNDBUCH' },
          { fileName: 'Handelsregisterauszug.pdf', documentType: 'REGISTER' },
        ],
        notes: 'Liegenschaft liegt im Sanierungsgebiet Hamburg-Mitte.',
      },
    },
    {
      name: 'Szenario 3: Erbfall & Erbschein (Unberichtigtes Grundbuch)',
      description: 'Verkäufer sind die Erben. Der Erblasser ist noch im Grundbuch eingetragen.',
      context: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        fields: {
          grundbuch: {
            data: { eigentuemer: 'Eheleute Schmidt (Erblasser verstorben)' },
          },
        },
        detectedDocuments: [
          { fileName: 'Testament_und_Erbschein.pdf', documentType: 'NACHLASS' },
          { fileName: 'Grundbuchauszug.pdf', documentType: 'GRUNDBUCH' },
        ],
        notes: 'Erblasser noch im Grundbuch eingetragen, Erben verkaufen.',
      },
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    console.log(`\n${'#'.repeat(80)}`);
    console.log(`📌 [${index + 1}/${scenarios.length}] ${scenario.name}`);
    console.log(`ℹ️  Fall: ${scenario.description}`);
    console.log('-'.repeat(80));

    // 1. Deterministische Rechtsregeln (aus IKnowledgeRepository, nicht aus Code!)
    const allStatutory = await repo.getStatutoryRules();
    const selectedRules = selectApplicableKnowledge(allStatutory, scenario.context);
    console.log(`\n[Schritt 1: Deterministischer Regel-Filter aus IKnowledgeRepository]`);
    console.log(`-> Gefundene Prüfnormen: ${selectedRules.length}`);
    selectedRules.forEach((rule) => {
      console.log(
        `   ⚖️  ${rule.legalBasis}: ${rule.title} (${rule.isGlobal ? 'Global' : 'Trigger-Match'})`
      );
    });

    // 2. Kanzlei- & DNotI-Wissensdatenbank (Stufe B - Hybrid Search)
    const rawDocs = scenario.context.detectedDocuments;
    const docNames = rawDocs.map((d) => d.fileName).filter(Boolean);
    const searchTerms = [scenario.context.caseType, scenario.context.notes, ...docNames].join(' ');

    const knowledgeResults = await repo.search({
      queryText: searchTerms,
      topK: 2,
    });

    console.log(`\n[Schritt 2: Hybrid Knowledge Search (BM25 + Vektor)]`);
    console.log(`-> Gefundene Gutachten/Präzedenzen: ${knowledgeResults.length}`);
    knowledgeResults.forEach((kr) => {
      console.log(
        `   📚 [Score: ${kr.combinedScore}] [${kr.matchSource}] ${kr.document.legalBasis}: ${kr.document.title}`
      );
    });

    // 3. Generierter Prompt-Zusatz (Was dem LLM übergeben wird)
    const promptInjection = formatKnowledgeForPrompt(selectedRules, knowledgeResults);
    const charCount = promptInjection.length;
    const estimatedTokens = Math.ceil(charCount / 4);

    console.log(`\n[Schritt 3: Generierter Prompt-Auszug (Injektion in Stufe 2)]`);
    console.log('┌' + '─'.repeat(78) + '┐');
    promptInjection
      .trim()
      .split('\n')
      .forEach((line) => {
        console.log(`│ ${line.padEnd(76).slice(0, 76)} │`);
      });
    console.log('└' + '─'.repeat(78) + '┘');

    console.log(`\n📊 Effizienz & Token-Statistik für diesen Fall:`);
    console.log(`   • Zeichenlänge Injektion: ${charCount} Zeichen`);
    console.log(`   • Geschätzter Token-Bedarf: ~${estimatedTokens} Tokens`);
    console.log(
      `   • Geschätzte Kosten bei Gemini Flash (ca. 0,0001 $ pro 1k Input): ~${((estimatedTokens / 1000) * 0.0001).toFixed(6)} $ (< 0,0001 €)`
    );
    console.log(
      `   • Eingesparte Tokens gegenüber statischem Mega-Prompt (~8.000 Tokens): ca. ${8000 - estimatedTokens} Tokens gespart (~${Math.round(((8000 - estimatedTokens) / 8000) * 100)} % Ersparnis)`
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 INSPEKTION ABGESCHLOSSEN');
  console.log('='.repeat(80));
}

runRagInspection().catch(console.error);
