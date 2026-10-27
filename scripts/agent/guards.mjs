// Reine Entscheidungslogik der Agenten-Guards (testbar, ohne I/O).
// Rückgabe: { decision: 'allow' | 'deny' | 'ask', reason }

const allow = { decision: 'allow', reason: '' };
const deny = (reason) => ({ decision: 'deny', reason });
const ask = (reason) => ({ decision: 'ask', reason });

const ENV_FILE = /(^|[\s/'"=])\.env(?!\.example\b)(\.[\w.-]+)?(?=$|[\s'";|&)])/;

export function evaluateCommand(command) {
  const cmd = (command ?? '').trim();

  if (/\bgit\s+push\b[^\n;|&]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/.test(cmd)) {
    return deny('Force-Push nur mit ausdrücklicher Zustimmung des Nutzers.');
  }
  if (/\bgit\b[^\n;|&]*\s--no-verify\b|\bgit\s+commit\b[^\n;|&]*\s-n\b/.test(cmd)) {
    return deny('Hooks nie mit --no-verify umgehen; Ursache beheben.');
  }
  if (/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.|restore\s+\.)/.test(cmd)) {
    return ask('Verwirft lokale Änderungen unwiderruflich.');
  }
  if (/\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(-\S+\s+)*(\/|~|\.\.|\*|\$HOME)(\s|$)/.test(cmd)) {
    return deny('Gefährliches rekursives Löschen.');
  }
  if (
    /\b(cat|less|more|head|tail|grep|rg|sed|awk|cp|mv|base64|source|printenv|env)\b/.test(cmd) &&
    ENV_FILE.test(cmd)
  ) {
    return deny('Zugriff auf echte .env-Dateien ist verboten; .env.example ist lesbar.');
  }
  if (/\b(curl|wget)\b[^\n]*\|\s*(sh|bash|zsh)\b/.test(cmd)) {
    return deny('Skripte aus dem Netz nicht direkt ausführen.');
  }
  if (
    /\bsupabase\s+(db\s+reset|db\s+push|link|projects\s+delete)\b/.test(cmd) &&
    /--(linked|db-url)/.test(cmd)
  ) {
    return ask('Wirkt auf ein entferntes Datenbanksystem.');
  }
  return allow;
}

/** Geänderte, noch vorhandene Quelldateien (ts/tsx unter src/) aus `git status --porcelain`. */
export function selectChangedSources(porcelain) {
  return porcelain
    .split('\n')
    .filter((line) => line.length > 3 && !line.slice(0, 2).includes('D'))
    .map((line) => line.slice(3).split(' -> ').pop().trim().replace(/^"|"$/g, ''))
    .filter((file) => /^src\/.*\.(ts|tsx)$/.test(file));
}

/** Prüfschritte des Stop-Hooks für die geänderten Dateien; ohne Dateien keine Schritte. */
export function buildStopSteps(files) {
  if (files.length === 0) return [];
  return [
    ['npx', ['tsc', '--noEmit']],
    ['npx', ['eslint', ...files]],
    ['npx', ['vitest', 'related', '--run', '--passWithNoTests', ...files]],
  ];
}

export function evaluateFileWrite(filePath) {
  const path = (filePath ?? '').replace(/\\/g, '/');
  const base = path.split('/').pop() ?? '';

  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') {
    return deny(`Secrets-Datei "${base}" darf nicht bearbeitet werden.`);
  }
  if (/^(id_rsa.*|.*\.pem|.*\.key|credentials\.json)$/i.test(base)) {
    return deny(`Schlüsseldatei "${base}" darf nicht bearbeitet werden.`);
  }
  if (/^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(base)) {
    return deny('Lockfiles werden nur vom Paketmanager geändert.');
  }
  if (
    /(^|\/)(AGENTS\.md|CLAUDE\.md)$/.test(path) ||
    /(^|\/)\.claude\/settings(\.local)?\.json$/.test(path) ||
    /(^|\/)\.husky\//.test(path) ||
    /(^|\/)scripts\/agent\//.test(path) ||
    /(^|\/)\.github\/workflows\//.test(path)
  ) {
    return ask(`"${base}" ist eine Regel- bzw. Schutzdatei und braucht Bestätigung.`);
  }
  return allow;
}
