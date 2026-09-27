import * as fs from 'node:fs';
import * as path from 'node:path';
import { LayerEvalSuiteReport } from '@/types/eval';

/**
 * Erstellt ein interaktives Standalone-HTML-Dokument (Zero-Dependency),
 * das die Zwischenartefakte, Bounding-Boxen, Prompts, Knowledge-Docs
 * und Diffs für jeden Schritt visuell nachvollziehbar darstellt.
 */
export function generateInteractiveHtmlReport(report: LayerEvalSuiteReport): string {
  const jsonData = JSON.stringify(report).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="de" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notar Agent - Multi-Stage Pipeline Eval Report</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: #1f2937;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --accent: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 13px;
      line-height: 1.4;
      padding: 12px 20px;
    }
    /* Compact Integrated Header Bar */
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h1 { font-size: 1.05rem; font-weight: 700; margin: 0; }
    .badge {
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid var(--danger); }

    /* Accessibility Focus Ring (WCAG 2.1 AA) */
    :focus-visible {
      outline: 2px solid #60a5fa !important;
      outline-offset: 2px !important;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Case Selector Bar - Kompakt & nahtlos */
    .case-selector {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      align-items: center;
    }
    .case-chip {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .case-chip:hover { border-color: var(--accent); }
    .case-chip.active { background: #1d4ed8; border-color: #60a5fa; color: #fff; font-weight: 600; }

    /* Main 2-Column Layout */
    .workspace-grid {
      display: grid;
      grid-template-columns: 740px 1fr;
      gap: 20px;
      align-items: start;
    }
    @media (max-width: 1350px) {
      .workspace-grid { grid-template-columns: 1fr; }
    }

    /* Left: Document View */
    .document-panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
    }
    .canvas-container {
      position: relative;
      width: 708px;
      height: 1002px;
      background: #050811;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .doc-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
    .overlay-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    /* Filter & Navigation Bar - Clean, spacious, easy to click */
    .doc-toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #0d1322;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .doc-toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-btn {
      background: #1f2937;
      border: 1px solid #374151;
      color: #e5e7eb;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease-in-out;
    }
    .filter-btn:hover {
      background: #374151;
      border-color: #60a5fa;
      color: #fff;
    }
    .filter-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }

    .page-btn {
      background: #1f2937;
      border: 1px solid #374151;
      color: #e5e7eb;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      min-width: 32px;
      text-align: center;
      transition: all 0.15s;
    }
    .page-btn:hover {
      background: #374151;
      border-color: #60a5fa;
    }
    .page-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
      color: #ffffff;
    }

    /* Marker: Klar erkennbare Kontur mit leichtem Leuchten, aber ohne den Text zu verdecken */
    .box-marker {
      position: absolute;
      cursor: pointer;
      box-sizing: border-box;
      border-radius: 3px;
      transition: all 0.15s ease-in-out;
    }
    .box-marker.marker-pointer {
      border: 2px solid #ef4444;
      background: rgba(239, 68, 68, 0.12);
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
    }
    .box-marker.marker-field {
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.10);
      box-shadow: 0 0 4px rgba(59, 130, 246, 0.3);
    }
    .box-marker:hover {
      background: rgba(245, 158, 11, 0.35) !important;
      border-color: #f59e0b !important;
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.8) !important;
      z-index: 100 !important;
    }

    /* Target badge indicator on key markers: gut sichtbarer roter Pfeil-Pin */
    .pin-indicator {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 1px 5px;
      background: #ef4444;
      color: #ffffff;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      pointer-events: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.6);
      white-space: nowrap;
    }

    /* Right: Extracted Data & Verdicts - Sticky mitlaufend */
    .data-panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: sticky;
      top: 14px;
      max-height: calc(100vh - 28px);
      overflow-y: auto;
    }

    /* Floating Smart Tooltip direkt an der Markierung */
    .marker-tooltip {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: #0b1329;
      color: #38bdf8;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 6px 10px;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 0.75rem;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.15s ease-in-out;
    }
    .box-marker:hover .marker-tooltip,
    .box-marker:focus .marker-tooltip {
      opacity: 1;
    }

    /* Minimal Table */
    .verdict-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .verdict-table th, .verdict-table td {
      border-bottom: 1px solid var(--border);
      padding: 8px 10px;
      text-align: left;
    }
    .verdict-table th { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .status-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    .status-ok { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .status-err { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
  </style>
</head>
<body>
  <header role="banner">
    <div class="header-brand">
      <h1>📄 Pipeline Eval</h1>
      <span style="color: var(--text-muted); font-size: 0.78rem;" id="meta-run-info"></span>
      <div id="overall-badge" aria-live="polite"></div>
    </div>
    <!-- Horizontale Fallauswahl direkt im Header integriert -->
    <nav aria-label="Fallauswahl">
      <div class="case-selector" id="case-chips" role="tablist"></div>
    </nav>
  </header>

  <!-- 2-Spalten-Fokus: Links Dokument mit Markern, Rechts Daten & Begründungen -->
  <main class="workspace-grid" role="main">
    <section class="document-panel" aria-labelledby="doc-title">
      <!-- Ergonomische Toolbar für Filter & Seitenauswahl -->
      <div class="doc-toolbar" role="toolbar" aria-label="Dokumentensteuerung">
        <div class="doc-toolbar-group">
          <h2 id="doc-title" style="font-size: 0.95rem; color: #fff; margin: 0;">Dokument</h2>
          <div id="page-nav" role="group" aria-label="Seitenauswahl" style="display: flex; align-items: center; gap: 4px; margin-left: 6px;"></div>
        </div>
        <div class="doc-toolbar-group" role="group" aria-label="Markierungsebene">
          <button id="filter-annotations-btn" class="filter-btn active" aria-pressed="true" onclick="setMarkerFilter('annotations')">✍️ Erkannte Marker</button>
          <button id="filter-off-btn" class="filter-btn" aria-pressed="false" onclick="setMarkerFilter('none')">Aus (Pur)</button>
        </div>
      </div>
      <div class="canvas-container" id="canvas-container" tabindex="0" role="region" aria-label="Dokumentenvorschau mit visuellen Markern">
        <img id="doc-img" class="doc-img" src="" alt="Vorschau der aktuellen Dokumentenseite" />
        <div class="overlay-layer" id="overlay-layer" role="group" aria-label="Erkannte Dokumentenmarkierungen"></div>
      </div>
    </section>

    <section class="data-panel" aria-label="Erkennungs- und Prüfergebnisse">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        <h3 style="font-size: 0.95rem; margin: 0;">⚖️ Extrahierte Daten & Soll-Ist-Abgleich</h3>
        <span style="font-size: 0.75rem; color: var(--text-muted);">Hover über Marker zeigt Tooltip</span>
      </div>
      <table class="verdict-table" aria-label="Soll-Ist-Abgleich der extrahierten Daten">
        <thead>
          <tr>
            <th scope="col">Feld</th>
            <th scope="col">Soll</th>
            <th scope="col">Ist (Erkannt)</th>
            <th scope="col">Status</th>
            <th scope="col">Begründung</th>
          </tr>
        </thead>
        <tbody id="verdict-tbody"></tbody>
      </table>
    </section>
  </main>

  <script>
    const report = ${jsonData};
    let activeIdx = 0;

    function init() {
      document.getElementById('meta-run-info').textContent = 'Lauf-ID: ' + report.runId + ' • ' + new Date(report.timestamp).toLocaleTimeString('de-DE') + ' Uhr';
      document.getElementById('overall-badge').innerHTML = report.passed
        ? '<span class="badge badge-success" role="status">✓ 100% KORREKT</span>'
        : '<span class="badge badge-danger" role="status">✗ ABWEICHUNG</span>';

      renderChips();
      renderCase(0);
    }

    function renderChips() {
      const container = document.getElementById('case-chips');
      container.innerHTML = '';
      (report.caseTraces || []).forEach((tc, idx) => {
        const chip = document.createElement('button');
        chip.className = 'case-chip' + (idx === activeIdx ? ' active' : '');
        chip.setAttribute('role', 'tab');
        chip.setAttribute('aria-selected', idx === activeIdx ? 'true' : 'false');
        chip.setAttribute('tabindex', idx === activeIdx ? '0' : '-1');
        chip.onclick = () => {
          activeIdx = idx;
          renderChips();
          renderCase(idx);
        };
        chip.innerHTML = \`
          <span>\${tc.caseId.split('-')[0].toUpperCase()} \${tc.caseId.split('-')[1]}</span>
          <span style="font-size: 0.75rem; color: \${tc.passed ? '#10b981' : '#ef4444'};" aria-label="\${tc.passed ? 'Bestanden' : 'Fehlgeschlagen'}">\${tc.passed ? '✓' : '✗'}</span>
        \`;
        container.appendChild(chip);
      });
    }

    let currentFilter = 'annotations';
    let activePage = 1;

    function setMarkerFilter(filter) {
      currentFilter = filter;
      ['annotations', 'none'].forEach(f => {
        const btnId = 'filter-' + (f === 'annotations' ? 'annotations' : 'off') + '-btn';
        const btn = document.getElementById(btnId);
        if (btn) {
          const isAct = f === filter;
          if (isAct) btn.classList.add('active');
          else btn.classList.remove('active');
          btn.setAttribute('aria-pressed', isAct ? 'true' : 'false');
        }
      });
      renderCase(activeIdx);
    }

    function setPage(p) {
      activePage = p;
      renderCase(activeIdx);
    }

    function renderCase(idx) {
      const tc = report.caseTraces ? report.caseTraces[idx] : null;
      if (!tc) return;

      const step1 = (tc.steps || []).find(s => s.stepNumber === 1);
      const blocks = step1?.artifacts?.blocks || [];
      const screenshots = step1?.artifacts?.pageScreenshots || [];
      const totalPages = step1?.artifacts?.totalPages || screenshots.length || 1;

      // Wenn gewählte Seite nicht existiert, Seite 1 nehmen
      let screenshot = screenshots.find(s => s.pageNum === activePage) || screenshots[0];
      const currentPage = screenshot?.pageNum || 1;

      document.getElementById('doc-title').textContent = step1?.artifacts?.fileName || tc.caseName || tc.caseId;

      // Seitennavigation rendern
      const pageNav = document.getElementById('page-nav');
      if (totalPages > 1) {
        let navHtml = '<span style="color: var(--text-muted); font-size: 0.82rem; margin: 0 4px;">Seite:</span>';
        for (let p = 1; p <= totalPages; p++) {
          const isAct = p === currentPage;
          navHtml += \`<button class="page-btn \${isAct ? 'active' : ''}" aria-label="Zu Seite \${p}" aria-current="\${isAct ? 'page' : 'false'}" onclick="setPage(\${p})">\${p}</button>\`;
        }
        pageNav.innerHTML = navHtml;
      } else {
        pageNav.innerHTML = '';
      }

      // Bild laden
      const img = document.getElementById('doc-img');
      if (screenshot?.base64Png) {
        img.src = screenshot.base64Png;
        img.style.display = 'block';
      } else {
        img.style.display = 'none';
      }

      // Marker rendern
      const overlay = document.getElementById('overlay-layer');
      overlay.innerHTML = '';

      if (currentFilter !== 'none') {
        const container = document.getElementById('canvas-container');
        const cw = container.clientWidth || 708;
        const ch = container.clientHeight || 1002;

        const pdfW = screenshot?.width ? screenshot.width / 2 : 595;
        const pdfH = screenshot?.height ? screenshot.height / 2 : 842;
        const sx = cw / pdfW;
        const sy = ch / pdfH;

        // Nur Blöcke der aktuellen Seite filtern!
        const pageBlocks = blocks.filter(b => (b.pageNumber || 1) === currentPage && b.bbox);

        // Gezielte Filterung:
        // 'pointers': Nur Pfeile und Zeiger-Symbole (▼, ▲, ►, ◄, Pfeil)
        // 'annotations': Alle handschriftlichen/nachträglichen Anmerkungen & Formularfelder
        const relevantBlocks = pageBlocks.filter(b => {
          const text = (b.content || '').trim();
          const isPointer = text.includes('▼') || text.includes('▲') || text.includes('►') || text.includes('◄') || b.type === 'pointer';
          if (currentFilter === 'pointers') return isPointer;
          if (currentFilter === 'annotations') return isPointer || b.type === 'annotation' || b.type === 'form_field';
          return false;
        });

        relevantBlocks.forEach((b) => {
          const left = Math.round((b.bbox.x || 0) * sx);
          const top = Math.round((b.bbox.y || 0) * sy);
          const width = Math.max(Math.round((b.bbox.width || 0) * sx), 12);
          const height = Math.max(Math.round((b.bbox.height || 0) * sy), 12);

          const isPointer = (b.content || '').includes('▼') || (b.content || '').includes('▲') || b.type === 'pointer';

          const marker = document.createElement('div');
          marker.className = 'box-marker ' + (isPointer ? 'marker-pointer' : 'marker-field');
          marker.style.left = left + 'px';
          marker.style.top = top + 'px';
          marker.style.width = width + 'px';
          marker.style.height = height + 'px';
          marker.style.zIndex = isPointer ? 50 : 20;

          // Accessibility: Tastaturnavigation & Screenreader-Support
          marker.setAttribute('tabindex', '0');
          marker.setAttribute('role', 'button');
          marker.setAttribute('aria-label', (isPointer ? 'Erkannter Zeiger: ' : 'Erkanntes Feld: ') + b.content);

          if (isPointer) {
            const pin = document.createElement('div');
            pin.className = 'pin-indicator';
            pin.setAttribute('aria-hidden', 'true');
            pin.textContent = 'ZEIGER ▼';
            marker.appendChild(pin);
          }

          // Tooltip direkt am Marker (schwebt beim Hovern/Fokussieren darüber)
          const tooltip = document.createElement('div');
          tooltip.className = 'marker-tooltip';
          tooltip.setAttribute('role', 'tooltip');
          tooltip.innerHTML = \`<strong>[\${b.type.toUpperCase()}]:</strong> "\${escapeHtml(b.content)}"\`;
          marker.appendChild(tooltip);

          overlay.appendChild(marker);
        });
      }

      // Soll-Ist Tabelle rendern
      const tbody = document.getElementById('verdict-tbody');
      tbody.innerHTML = '';

      if (tc.outcomeResult && tc.outcomeResult.fieldVerdicts) {
        tc.outcomeResult.fieldVerdicts.forEach((v) => {
          const tr = document.createElement('tr');
          const isOk = v.verdict?.matched;
          tr.innerHTML = \`
            <td><strong>\${v.fieldKey}</strong></td>
            <td><code style="color: var(--text-muted);">\${escapeHtml(JSON.stringify(v.expectedStatus))}</code></td>
            <td><code>\${escapeHtml(v.actualStatus || '-')}</code></td>
            <td><span class="status-pill \${isOk ? 'status-ok' : 'status-err'}" role="status">\${isOk ? '✓ Match' : '✗ Fehler'}</span></td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">\${escapeHtml(v.verdict?.reason || '-')}</td>
          \`;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="5" style="color: var(--text-muted); text-align: center;">Keine Vergleichsdaten</td></tr>';
      }
    }

    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.onload = init;
  </script>
</body>
</html>`;
}

/**
 * Speichert den HTML-Report im Projektordner reports/
 */
export function writeReportToFile(
  report: LayerEvalSuiteReport,
  targetFile = path.resolve(process.cwd(), 'reports', 'eval-report.html')
): string {
  const html = generateInteractiveHtmlReport(report);
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetFile, html, 'utf-8');
  return targetFile;
}
