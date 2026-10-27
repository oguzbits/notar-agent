const PROBE_ORIGIN = 'http://ziel.invalid';

/**
 * Lässt als Weiterleitungsziel nur einen relativen Pfad der eigenen Anwendung zu (Schutz vor Open Redirect).
 * Alles andere (fremde Hosts, `//host`, `/\host`, Schemata, Steuerzeichen) wird zu `/`.
 */
export function safeRedirectPath(target: string | null | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return '/';
  }
  // Der URL-Parser entfernt Tab/Zeilenumbruch und liest `\` als `/`: so wie der Browser auflösen
  const resolved = new URL(target, PROBE_ORIGIN);
  return resolved.origin === PROBE_ORIGIN ? target : '/';
}
