import { CaseType } from '@/types/dossier';
import { HybridSearchResult } from '@/types/knowledge';
import { AuditRule, NOTARY_AUDIT_RULES } from './rules-registry';

export interface RuleSelectionContext {
  caseType: CaseType;
  fields?: Record<string, unknown>;
  detectedDocuments?: Array<{ fileName?: string; documentType?: string }>;
  notes?: string;
  knowledgeResults?: HybridSearchResult[];
}

/**
 * Wählt deterministisch die für einen Aktenbestand relevanten notariellen Prüfnormen aus.
 * Verhindert Prompt-Bloat und sorgt für präzise Paragraphenbelege.
 */
export function selectRelevantAuditRules(context: RuleSelectionContext): AuditRule[] {
  const { fields, detectedDocuments = [], notes = '' } = context;

  // Erstelle einen durchsuchbaren Textkorpus aus allen vorhandenen Daten
  const corpusParts: string[] = [];

  if (fields) {
    try {
      corpusParts.push(JSON.stringify(fields).toLowerCase());
    } catch (err: unknown) {
      console.warn('Fehler bei der Serialisierung der Felder für Rule-Selection:', err);
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

  return NOTARY_AUDIT_RULES.filter((rule) => {
    // Globale Regeln für den CaseType immer injizieren
    if (rule.isGlobal) {
      return true;
    }

    // Spezifische Regeln bei Keyword-Match injizieren
    return rule.triggerKeywords.some((keyword) => {
      // Exakter Wortgrenzen-Match für kurze Kürzel wie "gbr", "ug", "ag", "kg"
      if (keyword.length <= 4) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(corpus);
      }
      return corpus.includes(keyword.toLowerCase());
    });
  });
}

/**
 * Formatiert die selektierten Regeln in eine schlanke Textsektion für den Stufe-2-Prompt.
 */
export function formatRulesForPrompt(
  rules: AuditRule[],
  knowledgeResults: HybridSearchResult[] = []
): string {
  const sections: string[] = [];

  if (rules.length > 0) {
    const formattedRules = rules
      .map(
        (r, i) =>
          `${i + 1}. [${r.legalBasis}] ${r.title}:
   - Prüfvorgabe: ${r.instruction}${r.suggestedAction ? `\n   - Bei Mangel/Lücke: ${r.suggestedAction}` : ''}`
      )
      .join('\n\n');
    sections.push(`=== GESETZLICHE PRÜFUNGSMASSSTÄBE ===\n${formattedRules}`);
  }

  if (knowledgeResults.length > 0) {
    const formattedKnowledge = knowledgeResults
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
