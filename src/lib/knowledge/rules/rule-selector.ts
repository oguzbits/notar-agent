import { CaseType } from '@/types/dossier';
import { HybridSearchResult, KnowledgeDocument } from '@/types/knowledge';

export interface RuleSelectionContext {
  caseType: CaseType;
  fields?: Record<string, unknown>;
  detectedDocuments?: Array<{ fileName?: string; documentType?: string }>;
  notes?: string;
}

/**
 * Universeller, zustandsloser Matching-Algorithmus (Mechanism gem. AGENTS.md).
 * Enthält ZERO hardcodierte Fachnormen oder Rechtsinhalte.
 * Nimmt beliebige KnowledgeDocuments entgegen und prüft Keyword-Matches sowie globale Flags.
 */
export function selectApplicableKnowledge(
  documents: KnowledgeDocument[],
  context: RuleSelectionContext
): KnowledgeDocument[] {
  const { fields, detectedDocuments = [], notes = '' } = context;

  // Erstelle einen durchsuchbaren Textkorpus aus allen Aktenmerkmalen
  const corpusParts: string[] = [];

  if (fields) {
    try {
      corpusParts.push(JSON.stringify(fields).toLowerCase());
    } catch (err: unknown) {
      console.warn('Fehler bei der Serialisierung der Felder für Knowledge-Selection:', err);
    }
  }

  for (const doc of detectedDocuments) {
    if (doc.fileName) corpusParts.push(doc.fileName.toLowerCase());
    if (doc.documentType) corpusParts.push(doc.documentType.toLowerCase());
  }

  if (notes) {
    corpusParts.push(notes.toLowerCase());
  }

  const corpus = corpusParts.join(' ');

  return documents.filter((doc) => {
    // Globale Regeln immer injizieren
    if (doc.isGlobal) {
      return true;
    }

    if (!doc.triggerKeywords || doc.triggerKeywords.length === 0) {
      return false;
    }

    // Spezifische Regeln bei Keyword-Match injizieren
    return doc.triggerKeywords.some((keyword) => {
      const lowerKeyword = keyword.toLowerCase();
      // Exakter Wortgrenzen-Match für kurze Kürzel wie "gbr", "ug", "ag", "kg" ohne dynamisches RegExp
      if (lowerKeyword.length <= 4) {
        let index = corpus.indexOf(lowerKeyword);
        while (index !== -1) {
          const charBefore = index > 0 ? corpus[index - 1] : ' ';
          const charAfter =
            index + lowerKeyword.length < corpus.length ? corpus[index + lowerKeyword.length] : ' ';
          const isBeforeWord = charBefore ? /\w/.test(charBefore) : false;
          const isAfterWord = charAfter ? /\w/.test(charAfter) : false;
          if (!isBeforeWord && !isAfterWord) {
            return true;
          }
          index = corpus.indexOf(lowerKeyword, index + 1);
        }
        return false;
      }
      return corpus.includes(lowerKeyword);
    });
  });
}

/**
 * Formatiert ausgewählte Wissensdokumente und RAG-Ergebnisse in eine schlanke Textsektion für den Prompt.
 */
export function formatKnowledgeForPrompt(
  statutoryRules: KnowledgeDocument[],
  hybridResults: HybridSearchResult[] = []
): string {
  const sections: string[] = [];

  if (statutoryRules.length > 0) {
    const formattedRules = statutoryRules
      .map(
        (r, i) =>
          `${i + 1}. [${r.legalBasis}] ${r.title}:
   - Prüfvorgabe: ${r.content}${r.suggestedAction ? `\n   - Bei Mangel/Lücke: ${r.suggestedAction}` : ''}`
      )
      .join('\n\n');
    sections.push(`=== GESETZLICHE PRÜFUNGSMASSSTÄBE ===\n${formattedRules}`);
  }

  // Deduplizieren gegen bereits enthaltene gesetzliche Normen
  const statutoryIds = new Set(statutoryRules.map((r) => r.id));
  const uniqueHybridResults = hybridResults.filter((hr) => !statutoryIds.has(hr.document.id));

  if (uniqueHybridResults.length > 0) {
    const formattedKnowledge = uniqueHybridResults
      .map(
        (kr, i) =>
          `${i + 1}. [${kr.document.legalBasis}${kr.document.courtOrAuthority ? ` — ${kr.document.courtOrAuthority}` : ''}] ${kr.document.title}:
   - Rechtliche Vorgabe: ${kr.document.content}`
      )
      .join('\n\n');
    sections.push(
      `=== EINSCHLÄGIGE DNOTI-GUTACHTEN & AMTSGERICHTS-PRAXIS ===\n${formattedKnowledge}`
    );
  }

  if (sections.length === 0) return '';
  return sections.join('\n\n') + '\n';
}
