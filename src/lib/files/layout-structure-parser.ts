/**
 * Layout Structure Parser (Step 1 Reading Order & Structure Harness).
 * Rekonstruiert logische Blöcke aus rohem Unicode-Text:
 * 1. Paragraphen- und Klausel-Hierarchien (§ 1, § 2, Art. 1)
 * 2. Grundbuchabteilungen (Bestandsverzeichnis, Abt. I, II, III)
 * 3. Tabellarische Daten mit Spaltenabständen (MFH-Mieterlisten, Ratenpläne) -> Markdown-Tabellen.
 */

export interface StructuredBlock {
  type: 'clause' | 'department' | 'table' | 'paragraph';
  title?: string;
  content: string;
}

export interface StructuredDocumentLayout {
  hasStructuredBlocks: boolean;
  blocks: StructuredBlock[];
  structuredMarkdown: string;
}

// Erkennung von Grundbuch-Gliederungen
const GRUNDBUCH_DEPT_REGEX =
  /^(Bestandsverzeichnis|Abteilung\s+(?:I{1,3}|[1-3])(?:\s*\([^)]*\))?)/i;

// Erkennung von notariellen Vertragsklauseln (§ 1, § 2, Paragraph 1)
const CLAUSE_HEADER_REGEX = /^((?:§+|Paragraph|Artikel)\s*\d+[\w.]*(?:\s+.*)?)/i;

/**
 * Prüft, ob eine Zeile tabellarisch mehrspaltig aufgebaut ist (2+ Leerzeichen als Trenner).
 */
function splitColumns(line: string): string[] {
  // Trennt bei 2 oder mehr aufeinanderfolgenden Leerzeichen oder Tabs
  const cols = line
    .split(/\t+|\s{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  return cols;
}

/**
 * Konvertiert eine zusammenhängende Gruppe von Tabellenzeilen in eine Markdown-Tabelle.
 */
function convertLinesToMarkdownTable(lines: string[]): string {
  if (lines.length === 0) return '';

  const parsedRows = lines.map(splitColumns);
  const maxCols = Math.max(...parsedRows.map((r) => r.length));

  if (maxCols < 2) {
    return lines.join('\n');
  }

  // Header-Zeile
  const header = parsedRows[0] ? [...parsedRows[0]] : [];
  while (header.length < maxCols) {
    header.push('');
  }

  const headerLine = `| ${header.join(' | ')} |`;
  const separatorLine = `|${Array(maxCols).fill('---').join('|')}|`;

  const bodyLines = parsedRows.slice(1).map((row) => {
    while (row.length < maxCols) {
      row.push('');
    }
    return `| ${row.join(' | ')} |`;
  });

  return [headerLine, separatorLine, ...bodyLines].join('\n');
}

/**
 * Analysiert den rohen Text und erzeugt eine layout-bewusste Markdown-Repräsentation.
 */
export function parseDocumentLayoutStructure(rawText: string): StructuredDocumentLayout {
  if (!rawText || rawText.trim() === '') {
    return {
      hasStructuredBlocks: false,
      blocks: [],
      structuredMarkdown: rawText,
    };
  }

  const lines = rawText.split(/\r?\n/);
  const blocks: StructuredBlock[] = [];
  let currentTableLines: string[] = [];
  let currentBlockLines: string[] = [];
  let currentBlockType: 'clause' | 'department' | 'paragraph' = 'paragraph';
  let currentBlockTitle: string | undefined = undefined;
  let hasStructuredBlocks = false;

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      if (currentTableLines.length >= 2) {
        // Mindestens 2 Zeilen (Header + Row) mit 2+ Spalten
        const tableMd = convertLinesToMarkdownTable(currentTableLines);
        blocks.push({
          type: 'table',
          content: tableMd,
        });
        hasStructuredBlocks = true;
      } else {
        currentBlockLines.push(...currentTableLines);
      }
      currentTableLines = [];
    }
  };

  const flushBlock = () => {
    flushTable();
    if (currentBlockLines.length > 0 || currentBlockTitle) {
      const content = currentBlockLines.join('\n').trim();
      blocks.push({
        type: currentBlockType,
        title: currentBlockTitle,
        content,
      });
      currentBlockLines = [];
      currentBlockTitle = undefined;
      currentBlockType = 'paragraph';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    if (!trimmed) {
      flushTable();
      if (currentBlockLines.length > 0) {
        currentBlockLines.push('');
      }
      continue;
    }

    // 1. Grundbuchabteilungen prüfen
    const deptMatch = trimmed.match(GRUNDBUCH_DEPT_REGEX);
    if (deptMatch) {
      flushBlock();
      currentBlockType = 'department';
      currentBlockTitle = trimmed;
      hasStructuredBlocks = true;
      continue;
    }

    // 2. Notarielle Klauseln (§ 1, § 2) prüfen
    const clauseMatch = trimmed.match(CLAUSE_HEADER_REGEX);
    if (clauseMatch) {
      flushBlock();
      currentBlockType = 'clause';
      currentBlockTitle = trimmed;
      hasStructuredBlocks = true;
      continue;
    }

    // 3. Tabellarische Spalten prüfen (2+ Spalten durch 2+ Leerzeichen)
    const cols = splitColumns(line);
    if (cols.length >= 2) {
      currentTableLines.push(line);
      continue;
    } else {
      flushTable();
      currentBlockLines.push(line);
    }
  }

  flushBlock();

  // Markdown-Repräsentation zusammensetzen
  const markdownParts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'department' && block.title) {
      markdownParts.push(`\n## ${block.title}\n`);
      if (block.content) markdownParts.push(block.content);
    } else if (block.type === 'clause' && block.title) {
      markdownParts.push(`\n### ${block.title}\n`);
      if (block.content) markdownParts.push(block.content);
    } else if (block.type === 'table') {
      markdownParts.push(`\n${block.content}\n`);
    } else {
      if (block.content) markdownParts.push(block.content);
    }
  }

  const structuredMarkdown = hasStructuredBlocks
    ? markdownParts
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : rawText;

  return {
    hasStructuredBlocks,
    blocks,
    structuredMarkdown,
  };
}
