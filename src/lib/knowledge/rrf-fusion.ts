export interface FusedRankItem<T> {
  item: T;
  score: number;
  textRank: number | null;
  vectorRank: number | null;
}

/**
 * Reciprocal Rank Fusion (RRF) nach Cormack, Clarke, Buettcher (SIGIR 2009).
 * Führt zwei unabhängige Rangfolgen (Volltext & Vektor) skaleninvariant zusammen.
 *
 * Formel pro Dokument d:
 *   RRF(d) = (textWeight / (k + rank_text(d))) + (vectorWeight / (k + rank_vector(d)))
 *
 * @param textRanked Die nach Volltext (`ts_rank_cd`) sortierten Dokumente.
 * @param vectorRanked Die nach semantischer Vektorähnlichkeit sortierten Dokumente.
 * @param textWeight Das Gewicht der Volltextsuche (Standard: 0.5).
 * @param vectorWeight Das Gewicht der Vektorsuche (Standard: 0.5).
 * @param k Dämpfungskonstante (Standard: 60, dämpft den Einfluss oberster Ränge).
 * @param limit Maximale Anzahl zurückgegebener Treffer.
 */
export function reciprocalRankFusion<T extends { id: string }>(
  textRanked: T[],
  vectorRanked: T[],
  textWeight = 0.5,
  vectorWeight = 0.5,
  k = 60,
  limit = 5
): FusedRankItem<T>[] {
  const itemMap = new Map<string, T>();
  const textRankMap = new Map<string, number>();
  const vectorRankMap = new Map<string, number>();
  const scoreMap = new Map<string, number>();

  // 1. Text-Rangfolge verarbeiten
  textRanked.forEach((item, index) => {
    const rank = index + 1;
    itemMap.set(item.id, item);
    textRankMap.set(item.id, rank);
    const part = textWeight / (k + rank);
    scoreMap.set(item.id, (scoreMap.get(item.id) ?? 0) + part);
  });

  // 2. Vektor-Rangfolge verarbeiten
  vectorRanked.forEach((item, index) => {
    const rank = index + 1;
    itemMap.set(item.id, item);
    vectorRankMap.set(item.id, rank);
    const part = vectorWeight / (k + rank);
    scoreMap.set(item.id, (scoreMap.get(item.id) ?? 0) + part);
  });

  // 3. Fusions-Scores sortieren
  const fused: FusedRankItem<T>[] = Array.from(itemMap.entries()).map(([id, item]) => ({
    item,
    score: scoreMap.get(id) ?? 0,
    textRank: textRankMap.get(id) ?? null,
    vectorRank: vectorRankMap.get(id) ?? null,
  }));

  return fused.sort((a, b) => b.score - a.score).slice(0, limit);
}
