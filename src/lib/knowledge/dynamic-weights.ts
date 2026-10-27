export interface DynamicWeightsResult {
  textWeight: number;
  vectorWeight: number;
  rationale: string;
}

/**
 * Berechnet dynamisch die Gewichtung zwischen Volltextsuche (`ts_rank_cd`) und semantischer Vektorsuche.
 *
 * Leitprinzip (gem. Roadmap & Invariante 5/6):
 * - Bei exakten Normen, Paragraphen (§), Registernummern (HRB) oder Flurstücken muss der Volltext
 *   priorisiert werden (textWeight = 0.85), da Vektorähnlichkeit Ziffern oft unscharf abbildet.
 * - Bei abstrakten semantischen Rechtsfragen (Fragewörter, Klauselverständnis) muss der Vektor
 *   priorisiert werden (vectorWeight = 0.75), da Volltextsuche an Begriffsvariationen scheitert.
 * - Bei kurzen Schlagwort-Kombinationen gilt die ausgewogene Standardgewichtung (0.50 / 0.50).
 */
export function calculateDynamicWeights(queryText: string): DynamicWeightsResult {
  const text = queryText.trim();
  const lowerText = text.toLowerCase();

  // 1. Indikatoren für exakte Ziffern, Paragraphen, Register und Kataster
  const hasParagraph = /[§]|(\b(art|abs|nr)\.\s*\d+)/i.test(text);
  const hasRegister = /\b(hrb|hra|gsr|pr|vr)\b\s*\d+/i.test(text);
  const hasParcel =
    /\b(flurstück|flur|parzelle|gemarkung|grundbuchblatt|blatt)\b/i.test(text) ||
    /\b\d+\/\d+\b/.test(text);
  const hasSpecificQuantity =
    /\b\d+(\.\d{3})*([,.]\d+)?\s*(euro|€|qm|m²|jahre|monate|prozent|%)\b/i.test(text);

  if (hasParagraph) {
    return {
      textWeight: 0.85,
      vectorWeight: 0.15,
      rationale: 'Exakter Paragrafen- oder Gesetzesbezug erkannt: Priorisiertes Volltext-Ranking.',
    };
  }

  if (hasRegister) {
    return {
      textWeight: 0.85,
      vectorWeight: 0.15,
      rationale: 'Registerzeichen oder Aktenzeichen erkannt: Priorisiertes Volltext-Ranking.',
    };
  }

  if (hasParcel) {
    return {
      textWeight: 0.85,
      vectorWeight: 0.15,
      rationale: 'Kataster- oder Flurstücksangabe erkannt: Priorisiertes Volltext-Ranking.',
    };
  }

  if (hasSpecificQuantity) {
    return {
      textWeight: 0.85,
      vectorWeight: 0.15,
      rationale: 'Spezifische Ziffern- oder Betragsangabe erkannt: Priorisiertes Volltext-Ranking.',
    };
  }

  // 2. Indikatoren für abstrakte semantische Fragestellungen
  const hasQuestionStructure =
    /\b(was|wie|wann|warum|welche|welcher|welches|wer|darf|kann|muss|sollte)\b/i.test(lowerText) ||
    text.endsWith('?');

  const hasConceptualVerbs =
    /\b(passiert|abwicklung|haftung|übergang|wirkung|rechtsfolge|voraussetzung|beachten|verhält)\b/i.test(
      lowerText
    );

  if (hasQuestionStructure || (hasConceptualVerbs && text.split(/\s+/).length >= 5)) {
    return {
      textWeight: 0.25,
      vectorWeight: 0.75,
      rationale:
        'Abstrakte rechtliche Fragestellung erkannt: Priorisiertes semantisches Vektor-Ranking.',
    };
  }

  // 3. Ausgewogener Standard
  return {
    textWeight: 0.5,
    vectorWeight: 0.5,
    rationale: 'Standard-Gewichtung für gemischte Suchbegriffe (50/50).',
  };
}
