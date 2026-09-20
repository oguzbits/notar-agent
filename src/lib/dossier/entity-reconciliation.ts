/**
 * Normalisiert Personennamen für deterministische Personenidentitätsprüfungen.
 * Entfernt akademische Grade, Amtsbezeichnungen und Sonderzeichen.
 */
export function normalizePersonName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/\b(dr|prof|dipl|ing|jur|rer|pol|habil|med)\b\.?/gi, '')
    .replace(/[,\.\-\/\\_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalisiert Unternehmensbezeichnungen für Register- und Beteiligtenabgleiche.
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/&/g, 'und')
    .replace(/\b(gmbh|ag|kg|ohg|ug|haftungsbeschränkt|haftungsbeschraenkt|egbr|gbr|co)\b/gi, '')
    .replace(/[,\.\-\/\\_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prüft, ob zwei Entitäten (Personen oder Gesellschaften) trotz minimaler
 * Schreibweisenunterschiede dieselbe Partei darstellen.
 */
export function isEntityMatch(candidate: string, target: string): boolean {
  if (!candidate || !target) return false;

  const candClean = normalizePersonName(candidate);
  const targetClean = normalizePersonName(target);

  if (!candClean || !targetClean) return false;
  if (candClean === targetClean) return true;

  // Enthaltenseins-Prüfung bei Vornamen / Doppelnamen
  if (candClean.includes(targetClean) || targetClean.includes(candClean)) {
    return true;
  }

  // Abgleich als Firma
  const candComp = normalizeCompanyName(candidate);
  const targetComp = normalizeCompanyName(target);
  if (
    candComp &&
    targetComp &&
    (candComp === targetComp || candComp.includes(targetComp) || targetComp.includes(candComp))
  ) {
    return true;
  }

  return false;
}
