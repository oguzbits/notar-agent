const PROBE_ORIGIN = 'http://ziel.invalid';

/**
 * Lässt als Weiterleitungsziel nur einen relativen Pfad der eigenen Anwendung zu (Schutz vor Open Redirect).
 * Alles andere (fremde Hosts, `//host`, `/\host`, Schemata, Steuerzeichen) wird zu `/`.
 */
export function safeRedirectPath(target: string | null | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return '/';
  }
  // Der URL-Parser entfernt Tab/Zeilenumbruch, liest `\` als `/` und löst `.`/`..` auf: so wie der Browser
  const resolved = new URL(target, PROBE_ORIGIN);
  // Ein normalisierter Pfad mit `//` am Anfang wäre beim nächsten Auflösen wieder ein fremder Host
  if (resolved.origin !== PROBE_ORIGIN || resolved.pathname.startsWith('//')) return '/';
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
