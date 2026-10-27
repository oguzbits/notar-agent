/**
 * Prüft, ob ein Pfad ein Upload-Pfad der Kanzlei ist (`<organizationId>/<Datei>`).
 * Pfade stammen aus Client-Eingaben; Archivpfade und fremde Kanzleien fallen heraus.
 */
export function isOwnUploadPath(path: string, organizationId: string): boolean {
  const prefix = `${organizationId}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}
