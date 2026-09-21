import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

/**
 * Erzeugt eine realistische, authentische Mieterliste als DIN A4-Scan / PDF
 * für ein Mehrfamilienhaus (MFH) in Köln:
 *
 * 1. Kopfbereich der Hausverwaltung (z. B. "Rheinische Immobilienverwaltung GmbH")
 * 2. Gedruckte Tabelle mit 28 Mietparteien und exakt 10 geforderten Spalten:
 *    - Lfd Nr.
 *    - Mieter
 *    - qm
 *    - Vertragsbeginn
 *    - Letzte Mietererhöhung
 *    - Gesamtzahlg. mtl. (EURO)
 *    - Heizkosten-VZ (EURO)
 *    - NK + Zuschl. (EURO)
 *    - Miete netto (EURO)
 *    - Miete EURO / qm
 * 3. Gedruckte Zwischensumme der ersten 28 Einheiten
 * 4. Handschriftlich mit blauem Kugelschreiber ergänzt:
 *    - Mieter 29 (z. B. Kowalski, Jan, 54,00 qm)
 *    - Mieter 30 (z. B. Öztürk, Aylin, 68,50 qm)
 * 5. Handschriftlich aktualisierte Summenzeilen:
 *    - Monatliche Gesamt-Nettomiete
 *    - Jährliche Nettomiete
 * 6. Eingebettet in PDF mit hochauflösendem Scanner-Bild.
 */
interface MieterRow {
  nr: number;
  name: string;
  qm: number;
  beginn: string;
  erhoehung: string;
  gesamt: number;
  hk: number;
  nk: number;
  netto: number;
  eurQm: number;
}

const printedTenants: Omit<MieterRow, 'netto' | 'eurQm'>[] = [
  {
    nr: 1,
    name: 'Schmidt, Klaus',
    qm: 54.5,
    beginn: '01.04.2014',
    erhoehung: '01.05.2023',
    gesamt: 710.0,
    hk: 85.0,
    nk: 65.0,
  },
  {
    nr: 2,
    name: 'Mueller, Sabine',
    qm: 48.0,
    beginn: '15.08.2016',
    erhoehung: '01.01.2022',
    gesamt: 630.0,
    hk: 75.0,
    nk: 60.0,
  },
  {
    nr: 3,
    name: 'Weber, Michael',
    qm: 72.0,
    beginn: '01.11.2018',
    erhoehung: '01.10.2023',
    gesamt: 950.0,
    hk: 110.0,
    nk: 90.0,
  },
  {
    nr: 4,
    name: 'Schneider, Frank',
    qm: 63.5,
    beginn: '01.02.2015',
    erhoehung: '01.03.2021',
    gesamt: 810.0,
    hk: 95.0,
    nk: 80.0,
  },
  {
    nr: 5,
    name: 'Fischer, Brigitte',
    qm: 51.0,
    beginn: '01.09.2012',
    erhoehung: '01.06.2022',
    gesamt: 650.0,
    hk: 80.0,
    nk: 65.0,
  },
  {
    nr: 6,
    name: 'Meyer, Thorsten',
    qm: 80.0,
    beginn: '01.05.2019',
    erhoehung: '01.05.2023',
    gesamt: 1060.0,
    hk: 125.0,
    nk: 95.0,
  },
  {
    nr: 7,
    name: 'Wagner, Christian',
    qm: 44.0,
    beginn: '15.01.2020',
    erhoehung: '-',
    gesamt: 590.0,
    hk: 70.0,
    nk: 55.0,
  },
  {
    nr: 8,
    name: 'Becker, Melanie',
    qm: 68.0,
    beginn: '01.07.2017',
    erhoehung: '01.08.2022',
    gesamt: 890.0,
    hk: 105.0,
    nk: 85.0,
  },
  {
    nr: 9,
    name: 'Schulz, Andreas',
    qm: 58.5,
    beginn: '01.10.2013',
    erhoehung: '01.04.2021',
    gesamt: 740.0,
    hk: 90.0,
    nk: 70.0,
  },
  {
    nr: 10,
    name: 'Hoffmann, Petra',
    qm: 76.0,
    beginn: '01.03.2016',
    erhoehung: '01.09.2023',
    gesamt: 990.0,
    hk: 115.0,
    nk: 95.0,
  },
  {
    nr: 11,
    name: 'Schaefer, Markus',
    qm: 49.0,
    beginn: '01.12.2020',
    erhoehung: '-',
    gesamt: 660.0,
    hk: 75.0,
    nk: 60.0,
  },
  {
    nr: 12,
    name: 'Koch, Julia',
    qm: 62.0,
    beginn: '15.06.2018',
    erhoehung: '01.02.2023',
    gesamt: 820.0,
    hk: 95.0,
    nk: 80.0,
  },
  {
    nr: 13,
    name: 'Bauer, Stefan',
    qm: 55.0,
    beginn: '01.08.2015',
    erhoehung: '01.11.2022',
    gesamt: 720.0,
    hk: 85.0,
    nk: 70.0,
  },
  {
    nr: 14,
    name: 'Richter, Monika',
    qm: 85.0,
    beginn: '01.04.2017',
    erhoehung: '01.05.2023',
    gesamt: 1120.0,
    hk: 130.0,
    nk: 105.0,
  },
  {
    nr: 15,
    name: 'Klein, Thomas',
    qm: 46.5,
    beginn: '01.02.2021',
    erhoehung: '-',
    gesamt: 620.0,
    hk: 70.0,
    nk: 60.0,
  },
  {
    nr: 16,
    name: 'Wolf, Alexander',
    qm: 70.0,
    beginn: '15.09.2019',
    erhoehung: '01.10.2023',
    gesamt: 930.0,
    hk: 110.0,
    nk: 90.0,
  },
  {
    nr: 17,
    name: 'Schroeder, Elena',
    qm: 53.0,
    beginn: '01.05.2014',
    erhoehung: '01.07.2022',
    gesamt: 690.0,
    hk: 85.0,
    nk: 65.0,
  },
  {
    nr: 18,
    name: 'Neumann, Daniel',
    qm: 65.0,
    beginn: '01.11.2017',
    erhoehung: '01.01.2023',
    gesamt: 860.0,
    hk: 100.0,
    nk: 80.0,
  },
  {
    nr: 19,
    name: 'Schwarz, Andrea',
    qm: 51.5,
    beginn: '01.03.2018',
    erhoehung: '01.04.2022',
    gesamt: 680.0,
    hk: 80.0,
    nk: 65.0,
  },
  {
    nr: 20,
    name: 'Zimmermann, Ralf',
    qm: 78.0,
    beginn: '15.10.2015',
    erhoehung: '01.09.2023',
    gesamt: 1020.0,
    hk: 120.0,
    nk: 100.0,
  },
  {
    nr: 21,
    name: 'Braun, Claudia',
    qm: 47.0,
    beginn: '01.01.2022',
    erhoehung: '-',
    gesamt: 640.0,
    hk: 75.0,
    nk: 60.0,
  },
  {
    nr: 22,
    name: 'Krueger, Martin',
    qm: 60.0,
    beginn: '01.06.2016',
    erhoehung: '01.03.2023',
    gesamt: 790.0,
    hk: 90.0,
    nk: 75.0,
  },
  {
    nr: 23,
    name: 'Hofmann, Nicole',
    qm: 56.0,
    beginn: '01.07.2019',
    erhoehung: '01.08.2023',
    gesamt: 750.0,
    hk: 85.0,
    nk: 70.0,
  },
  {
    nr: 24,
    name: 'Hartmann, Jan',
    qm: 82.5,
    beginn: '15.02.2017',
    erhoehung: '01.06.2023',
    gesamt: 1080.0,
    hk: 130.0,
    nk: 100.0,
  },
  {
    nr: 25,
    name: 'Lange, Katrin',
    qm: 50.0,
    beginn: '01.04.2020',
    erhoehung: '-',
    gesamt: 670.0,
    hk: 80.0,
    nk: 65.0,
  },
  {
    nr: 26,
    name: 'Schmitt, Tobias',
    qm: 73.0,
    beginn: '01.10.2016',
    erhoehung: '01.11.2022',
    gesamt: 960.0,
    hk: 110.0,
    nk: 90.0,
  },
  {
    nr: 27,
    name: 'Werner, Sarah',
    qm: 52.0,
    beginn: '01.08.2021',
    erhoehung: '-',
    gesamt: 700.0,
    hk: 80.0,
    nk: 70.0,
  },
  {
    nr: 28,
    name: 'Krause, Bernd',
    qm: 66.5,
    beginn: '15.05.2018',
    erhoehung: '01.05.2023',
    gesamt: 880.0,
    hk: 105.0,
    nk: 85.0,
  },
];

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function generateMieterlisteScan() {
  const width = 1400;
  const height = 1980;

  // Berechne gedruckte Werte
  const rows: MieterRow[] = printedTenants.map((t) => {
    const netto = t.gesamt - t.hk - t.nk;
    const eurQm = netto / t.qm;
    return { ...t, netto, eurQm };
  });

  const sumQm = rows.reduce((acc, r) => acc + r.qm, 0);
  const sumGesamt = rows.reduce((acc, r) => acc + r.gesamt, 0);
  const sumHk = rows.reduce((acc, r) => acc + r.hk, 0);
  const sumNk = rows.reduce((acc, r) => acc + r.nk, 0);
  const sumNetto = rows.reduce((acc, r) => acc + r.netto, 0);
  const avgEurQm = sumNetto / sumQm;

  // Handschriftliche Mieter 29 und 30
  const h29 = {
    nr: 29,
    name: 'Kowalski, Jan',
    qm: 54.0,
    beginn: '01.02.2024',
    erhoehung: '-',
    gesamt: 740.0,
    hk: 90.0,
    nk: 70.0,
    netto: 580.0,
    eurQm: 10.74,
  };
  const h30 = {
    nr: 30,
    name: 'Oeztuerk, Aylin',
    qm: 68.5,
    beginn: '15.03.2024',
    erhoehung: '-',
    gesamt: 950.0,
    hk: 120.0,
    nk: 90.0,
    netto: 740.0,
    eurQm: 10.8,
  };

  const finalNettoMtl = sumNetto + h29.netto + h30.netto;
  const finalNettoJaehrlich = finalNettoMtl * 12;

  interface TableCol {
    name: string;
    x: number;
    align: 'center' | 'left' | 'right';
    w: number;
  }

  // Layout-Spalten (x-Positionen)
  // Gesamtbreite Tabelle: 60 bis 1340
  const cols: [
    TableCol,
    TableCol,
    TableCol,
    TableCol,
    TableCol,
    TableCol,
    TableCol,
    TableCol,
    TableCol,
    TableCol,
  ] = [
    { name: 'Lfd. Nr.', x: 60, align: 'center', w: 55 },
    { name: 'Mieter', x: 125, align: 'left', w: 185 },
    { name: 'qm', x: 315, align: 'right', w: 65 },
    { name: 'Vertragsbeginn', x: 390, align: 'center', w: 115 },
    { name: 'Letzte Mieterhoehung', x: 515, align: 'center', w: 130 },
    { name: 'Gesamtzahlg. mtl. (EURO)', x: 655, align: 'right', w: 150 },
    { name: 'Heizkosten-VZ (EURO)', x: 815, align: 'right', w: 125 },
    { name: 'NK + Zuschl. (EURO)', x: 950, align: 'right', w: 120 },
    { name: 'Miete netto (EURO)', x: 1080, align: 'right', w: 120 },
    { name: 'Miete EURO / qm', x: 1210, align: 'right', w: 120 },
  ];

  const tableTopY = 280;
  const rowHeight = 35;

  let tableRowsSvg = '';
  rows.forEach((r, idx) => {
    const y = tableTopY + (idx + 1) * rowHeight;
    const isEven = idx % 2 === 0;
    const bg = isEven ? '#F8F9FA' : '#FFFFFF';

    tableRowsSvg += `
      <rect x="60" y="${y - 24}" width="1280" height="${rowHeight}" fill="${bg}" />
      <line x1="60" y1="${y + 11}" x2="1340" y2="${y + 11}" stroke="#E0E0E0" stroke-width="1" />
      <text x="${cols[0].x + 27}" y="${y}" font-size="13" text-anchor="middle" fill="#333">${r.nr}</text>
      <text x="${cols[1].x}" y="${y}" font-size="13" text-anchor="start" font-weight="500" fill="#222">${r.name}</text>
      <text x="${cols[2].x + cols[2].w}" y="${y}" font-size="13" text-anchor="end" fill="#333">${fmt(r.qm)}</text>
      <text x="${cols[3].x + cols[3].w / 2}" y="${y}" font-size="13" text-anchor="middle" fill="#555">${r.beginn}</text>
      <text x="${cols[4].x + cols[4].w / 2}" y="${y}" font-size="13" text-anchor="middle" fill="#555">${r.erhoehung}</text>
      <text x="${cols[5].x + cols[5].w}" y="${y}" font-size="13" text-anchor="end" fill="#333">${fmt(r.gesamt)}</text>
      <text x="${cols[6].x + cols[6].w}" y="${y}" font-size="13" text-anchor="end" fill="#555">${fmt(r.hk)}</text>
      <text x="${cols[7].x + cols[7].w}" y="${y}" font-size="13" text-anchor="end" fill="#555">${fmt(r.nk)}</text>
      <text x="${cols[8].x + cols[8].w}" y="${y}" font-size="13" text-anchor="end" font-weight="bold" fill="#111">${fmt(r.netto)}</text>
      <text x="${cols[9].x + cols[9].w}" y="${y}" font-size="13" text-anchor="end" fill="#444">${fmt(r.eurQm)}</text>
    `;
  });

  const printedSubtotalY = tableTopY + 29 * rowHeight;
  const hand29Y = printedSubtotalY + rowHeight + 10;
  const hand30Y = hand29Y + rowHeight + 2;
  const handSumY = hand30Y + rowHeight + 15;

  const svgContent = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Realistische Scanner- und Papiertextur -->
      <filter id="scanner-noise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
        <feColorMatrix type="matrix" values="0.05 0 0 0 0.98   0 0.05 0 0 0.98   0 0 0.05 0 0.96  0 0 0 1 0" />
      </filter>

      <!-- Tinten-Filter fuer handschriftliche Eintraege -->
      <filter id="blue-ink" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.18" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>

    <!-- Hintergrund & Textur -->
    <rect width="${width}" height="${height}" fill="#FAFAF8" />
    <rect width="${width}" height="${height}" filter="url(#scanner-noise)" opacity="0.4" />

    <!-- Briefkopf der Hausverwaltung -->
    <g font-family="Helvetica, Arial, sans-serif">
      <text x="70" y="75" font-size="18" font-weight="bold" fill="#1A365D" letter-spacing="0.5">RHEINISCHE IMMOBILIENVERWALTUNG GMBH</text>
      <text x="70" y="98" font-size="13" fill="#64748B">Kaiser-Wilhelm-Ring 27-29, 50672 Koeln • Tel: 0221 / 94820-0 • www.rheinische-hausverwaltung.de</text>
      <line x1="70" y1="115" x2="1330" y2="115" stroke="#CBD5E1" stroke-width="1.5" />

      <!-- Dokumententitel & Metadaten -->
      <text x="70" y="155" font-size="24" font-weight="bold" fill="#0F172A">AKTUELLE MIETUEBERSICHT (SOLL- / IST-AUFSTELLUNG)</text>
      <text x="70" y="185" font-size="15" fill="#334155"><tspan font-weight="bold">Liegenschaft:</tspan> Mehrfamilienhaus Lindenthaler Guertel 42-44, 50935 Koeln</text>
      <text x="70" y="210" font-size="14" fill="#475569"><tspan font-weight="bold">Grundbuch:</tspan> Lindenthal Bl. 4819 • <tspan font-weight="bold">Stichtag:</tspan> 01.03.2026 • <tspan font-weight="bold">Einheiten:</tspan> 30 Wohneinheiten</text>
      <text x="1330" y="210" font-size="13" text-anchor="end" fill="#64748B">Anlage zum Notarvertrag UR-Nr. ____ / 2026</text>

      <!-- Tabellen-Header -->
      <rect x="70" y="${tableTopY - 32}" width="1260" height="42" fill="#1E293B" rx="3" />
      ${cols
        .map((c) => {
          const anchor = c.align === 'left' ? 'start' : c.align === 'right' ? 'end' : 'middle';
          const posX = c.align === 'left' ? c.x : c.align === 'right' ? c.x + c.w : c.x + c.w / 2;
          return `<text x="${posX}" y="${tableTopY - 6}" font-size="13" font-weight="bold" fill="#FFFFFF" text-anchor="${anchor}">${c.name}</text>`;
        })
        .join('')}

      <!-- Gedruckte Tabellenzeilen 1 bis 28 -->
      ${tableRowsSvg}

      <!-- Gedruckte Zwischensumme (Zeile 28) -->
      <rect x="60" y="${printedSubtotalY - 24}" width="1280" height="38" fill="#E2E8F0" />
      <line x1="60" y1="${printedSubtotalY - 24}" x2="1340" y2="${printedSubtotalY - 24}" stroke="#94A3B8" stroke-width="1.5" />
      <line x1="60" y1="${printedSubtotalY + 14}" x2="1340" y2="${printedSubtotalY + 14}" stroke="#94A3B8" stroke-width="1.5" />
      
      <text x="${cols[1].x}" y="${printedSubtotalY}" font-size="13" font-weight="bold" fill="#0F172A">Zwischensumme (28 WE):</text>
      <text x="${cols[2].x + cols[2].w}" y="${printedSubtotalY}" font-size="13" font-weight="bold" text-anchor="end" fill="#0F172A">${fmt(sumQm)}</text>
      <text x="${cols[5].x + cols[5].w}" y="${printedSubtotalY}" font-size="13" font-weight="bold" text-anchor="end" fill="#0F172A">${fmt(sumGesamt)}</text>
      <text x="${cols[6].x + cols[6].w}" y="${printedSubtotalY}" font-size="13" font-weight="bold" text-anchor="end" fill="#475569">${fmt(sumHk)}</text>
      <text x="${cols[7].x + cols[7].w}" y="${printedSubtotalY}" font-size="13" font-weight="bold" text-anchor="end" fill="#475569">${fmt(sumNk)}</text>
      <text x="${cols[8].x + cols[8].w}" y="${printedSubtotalY}" font-size="14" font-weight="bold" text-anchor="end" fill="#0F172A">${fmt(sumNetto)}</text>
      <text x="${cols[9].x + cols[9].w}" y="${printedSubtotalY}" font-size="13" font-weight="bold" text-anchor="end" fill="#0F172A">${fmt(avgEurQm)}</text>
    </g>

    <!-- ============================================================== -->
    <!-- HANDSCHRIFTLICHE ERGAENZUNGEN MIT BLAUEM KUGELSCHREIBER -->
    <!-- ============================================================== -->
    <g filter="url(#blue-ink)" font-family="Brush Script MT, 'Segoe Script', cursive, sans-serif" fill="#0E3875">
      <!-- Trennlinie handschriftlich gezogener Vermerk -->
      <path d="M 60 ${printedSubtotalY + 22} Q 700 ${printedSubtotalY + 24} 1340 ${printedSubtotalY + 22}" stroke="#0E3875" stroke-width="1.6" fill="none" opacity="0.8" />

      <!-- Mieter 29 -->
      <g font-size="19" transform="rotate(-0.3 700 ${hand29Y})">
        <text x="${cols[0].x + 25}" y="${hand29Y}">29</text>
        <text x="${cols[1].x}" y="${hand29Y}">Kowalski, Jan (DG links)</text>
        <text x="${cols[2].x + cols[2].w}" y="${hand29Y}" text-anchor="end">54,00</text>
        <text x="${cols[3].x + cols[3].w / 2}" y="${hand29Y}" text-anchor="middle">01.02.2024</text>
        <text x="${cols[4].x + cols[4].w / 2}" y="${hand29Y}" text-anchor="middle">-</text>
        <text x="${cols[5].x + cols[5].w}" y="${hand29Y}" text-anchor="end">740,00</text>
        <text x="${cols[6].x + cols[6].w}" y="${hand29Y}" text-anchor="end">90,00</text>
        <text x="${cols[7].x + cols[7].w}" y="${hand29Y}" text-anchor="end">70,00</text>
        <text x="${cols[8].x + cols[8].w}" y="${hand29Y}" text-anchor="end" font-weight="bold">580,00</text>
        <text x="${cols[9].x + cols[9].w}" y="${hand29Y}" text-anchor="end">10,74</text>
      </g>

      <!-- Mieter 30 -->
      <g font-size="19" transform="rotate(0.2 700 ${hand30Y})">
        <text x="${cols[0].x + 25}" y="${hand30Y}">30</text>
        <text x="${cols[1].x}" y="${hand30Y}">Oeztuerk, Aylin (DG rechts)</text>
        <text x="${cols[2].x + cols[2].w}" y="${hand30Y}" text-anchor="end">68,50</text>
        <text x="${cols[3].x + cols[3].w / 2}" y="${hand30Y}" text-anchor="middle">15.03.2024</text>
        <text x="${cols[4].x + cols[4].w / 2}" y="${hand30Y}" text-anchor="middle">-</text>
        <text x="${cols[5].x + cols[5].w}" y="${hand30Y}" text-anchor="end">950,00</text>
        <text x="${cols[6].x + cols[6].w}" y="${hand30Y}" text-anchor="end">120,00</text>
        <text x="${cols[7].x + cols[7].w}" y="${hand30Y}" text-anchor="end">90,00</text>
        <text x="${cols[8].x + cols[8].w}" y="${hand30Y}" text-anchor="end" font-weight="bold">740,00</text>
        <text x="${cols[9].x + cols[9].w}" y="${hand30Y}" text-anchor="end">10,80</text>
      </g>

      <!-- Handschriftlicher Notiz-Kasten unten mit Gesamtsummen -->
      <path d="M 640 ${handSumY - 26} L 1342 ${handSumY - 28} L 1340 ${handSumY + 58} L 638 ${handSumY + 56} Z" stroke="#0C346E" stroke-width="2.2" fill="#F1F5F9" opacity="0.65" />
      <path d="M 642 ${handSumY - 24} L 1340 ${handSumY - 26}" stroke="#0C346E" stroke-width="1.4" fill="none" opacity="0.8" />
      <path d="M 640 ${handSumY + 16} L 1340 ${handSumY + 14}" stroke="#0C346E" stroke-width="1.4" fill="none" opacity="0.8" />

      <!-- Handschriftliche Summenzeilen -->
      <g font-size="20" transform="rotate(-0.4 1000 ${handSumY})">
        <text x="655" y="${handSumY - 2}">Gesamt-Nettomiete mtl. (inkl. WE 29+30):</text>
        <text x="${cols[9].x + cols[9].w}" y="${handSumY - 2}" text-anchor="end" font-weight="bold" font-size="23">${fmt(finalNettoMtl)} EUR</text>
      </g>

      <g font-size="20" transform="rotate(-0.2 1000 ${handSumY + 38})">
        <text x="655" y="${handSumY + 38}">Gesamt-Nettomiete jaehrlich (12 x mtl.):</text>
        <text x="${cols[9].x + cols[9].w}" y="${handSumY + 38}" text-anchor="end" font-weight="bold" font-size="24">${fmt(finalNettoJaehrlich)} EUR</text>
      </g>

      <!-- Handschriftlicher Randvermerk des Verwalters / Notars -->
      <g font-size="18" transform="rotate(-1.5 300 ${handSumY + 10})">
        <text x="80" y="${handSumY}">Nachtrag: WE 29 und 30 nach Dachausbau</text>
        <text x="80" y="${handSumY + 26}">neu vermietet. Miete per Dauerauftrag geprueft!</text>
        <text x="80" y="${handSumY + 52}">Koeln, den 04.03.2026</text>
        
        <!-- Notarielle Paraphe -->
        <path d="M 330 ${handSumY + 35} Q 350 ${handSumY + 10} 370 ${handSumY + 55} Q 380 ${handSumY + 70} 405 ${handSumY + 38} Q 420 ${handSumY + 20} 430 ${handSumY + 58}" stroke="#0C346E" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <circle cx="440" cy="55" r="2.5" fill="#0C346E" />
      </g>
    </g>

    <!-- Typische Scanner-Vignette und minimale Schattenkante links -->
    <rect x="0" y="0" width="10" height="${height}" fill="#000" opacity="0.07" />
    <rect x="0" y="0" width="${width}" height="8" fill="#000" opacity="0.04" />
  </svg>
  `;

  const outDir = path.resolve(process.cwd(), 'test-akten/fall-08-mieterliste-handschrift');
  fs.mkdirSync(outDir, { recursive: true });

  const pdfPath = path.join(outDir, 'Mieterliste_Objekt_Lindenthal.pdf');

  // 1. Rendere Scan-Bild im Speicher mit 0.35° minimalem Einzugsschlupf
  const pngBuffer = await sharp(Buffer.from(svgContent))
    .rotate(0.3, { background: '#FAFAF8' })
    .png({ quality: 95 })
    .toBuffer();

  // 2. Erzeuge DIN A4 PDF und bette das Scan-Bild ein
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // DIN A4 in Pt
  const embeddedPng = await pdfDoc.embedPng(pngBuffer);

  page.drawImage(embeddedPng, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);

  console.log(`✅ Mieterliste erfolgreich als PDF generiert:`);
  console.log(`   - Ordner: ${outDir}`);
  console.log(`   - PDF: ${pdfPath}`);
  console.log(`   - 28 gedruckte Einheiten: Netto ${fmt(sumNetto)} EUR / mtl.`);
  console.log(`   - + 2 handschriftliche Einheiten (29: 580 EUR, 30: 740 EUR)`);
  console.log(`   - = Handschriftliche Gesamt-Nettomiete mtl.: ${fmt(finalNettoMtl)} EUR`);
  console.log(`   - = Handschriftliche Gesamt-Nettomiete jährl.: ${fmt(finalNettoJaehrlich)} EUR`);
}

generateMieterlisteScan().catch(console.error);
