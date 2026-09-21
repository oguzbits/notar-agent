import path from 'path';
import sharp from 'sharp';

/**
 * Erzeugt einen echten, amtlichen Grundbuchauszug (Amtsgericht Köln, Grundbuch von Lindenthal Blatt 5412)
 * im typischen tabellarischen Amtsformat:
 * - Kopfzeile & Aufschrift (Amtsgericht, Band, Blatt)
 * - Bestandsverzeichnis mit Spalten (Lfd. Nr., Gemarkung, Flur, Flurstück, Wirtschaftsart & Lage, Größe)
 * - Dienstsiegel / Notariats-Beglaubigungsvermerk
 * - Bewusst: Hinweis "Seite 1 von 3", Folgeseite Abteilung I & II fehlt!
 */
async function generateAuthenticGrundbuchScan() {
  const width = 1240;
  const height = 1754;

  const svgDocument = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Leichtes Scan-Papier -->
      <filter id="paper" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
        <feColorMatrix type="matrix" values="0.05 0 0 0 0.97  0 0.05 0 0 0.96  0 0 0.05 0 0.94  0 0 0 1 0" />
      </filter>
    </defs>

    <!-- Hintergrund -->
    <rect width="${width}" height="${height}" fill="#FAF9F6" />
    <rect width="${width}" height="${height}" filter="url(#paper)" opacity="0.3" />

    <!-- Kopfbereich / Amtlicher Titel -->
    <g font-family="Arial, Helvetica, sans-serif" fill="#111">
      <text x="100" y="90" font-size="14" font-weight="bold" fill="#444">AMTSGERICHT KÖLN</text>
      <text x="100" y="110" font-size="12" fill="#666">Grundbuchamt • Reichenspergerplatz 1, 50670 Köln</text>
      <text x="${width - 100}" y="90" font-size="13" text-anchor="end" fill="#333">Druckdatum: 10.03.2026</text>
      <text x="${width - 100}" y="110" font-size="13" font-weight="bold" text-anchor="end" fill="#990000">SEITE 1 VON 3 (UNVOLLSTÄNDIG)</text>

      <line x1="100" y1="130" x2="${width - 100}" y2="130" stroke="#222" stroke-width="2" />

      <!-- Aufschrift -->
      <text x="${width / 2}" y="175" font-size="22" font-weight="bold" text-anchor="middle" letter-spacing="2">GRUNDBUCHAUSZUG</text>
      <text x="${width / 2}" y="210" font-size="16" text-anchor="middle">Amtsgericht Köln • Grundbuch von Lindenthal • Blatt 5412</text>
      <text x="${width / 2}" y="235" font-size="13" fill="#555" text-anchor="middle">Amtliche Abschrift gem. § 131 GBO für Notariat Dr. Weber</text>

      <!-- TABELLE: BESTANDSVERZEICHNIS -->
      <rect x="100" y="270" width="${width - 200}" height="35" fill="#E8ECE9" stroke="#333" stroke-width="1.5" />
      <text x="115" y="294" font-size="15" font-weight="bold">BESTANDSVERZEICHNIS</text>

      <!-- Tabellen-Header -->
      <g transform="translate(100, 305)" font-size="12" font-weight="bold">
        <rect width="1040" height="40" fill="#F0F0EE" stroke="#333" stroke-width="1" />
        <!-- Vertikale Linien -->
        <line x1="80" y1="0" x2="80" y2="40" stroke="#333" stroke-width="1" />
        <line x1="260" y1="0" x2="260" y2="40" stroke="#333" stroke-width="1" />
        <line x1="360" y1="0" x2="360" y2="40" stroke="#333" stroke-width="1" />
        <line x1="500" y1="0" x2="500" y2="40" stroke="#333" stroke-width="1" />
        <line x1="840" y1="0" x2="840" y2="40" stroke="#333" stroke-width="1" />

        <text x="15" y="25">Lfd. Nr.</text>
        <text x="95" y="25">Gemarkung</text>
        <text x="280" y="25">Flur</text>
        <text x="380" y="25">Flurstück</text>
        <text x="520" y="25">Wirtschaftsart und Lage</text>
        <text x="860" y="25">Größe (ha, a, m²)</text>
      </g>

      <!-- Tabellen-Zeile 1 -->
      <g transform="translate(100, 345)" font-size="13">
        <rect width="1040" height="90" fill="#FFFFFF" stroke="#333" stroke-width="1" />
        <line x1="80" y1="0" x2="80" y2="90" stroke="#333" stroke-width="1" />
        <line x1="260" y1="0" x2="260" y2="90" stroke="#333" stroke-width="1" />
        <line x1="360" y1="0" x2="360" y2="90" stroke="#333" stroke-width="1" />
        <line x1="500" y1="0" x2="500" y2="90" stroke="#333" stroke-width="1" />
        <line x1="840" y1="0" x2="840" y2="90" stroke="#333" stroke-width="1" />

        <text x="35" y="45" font-weight="bold">1</text>
        <text x="95" y="45">Lindenthal</text>
        <text x="300" y="45">7</text>
        <text x="410" y="45" font-weight="bold">88/2</text>
        
        <text x="520" y="35">Gebäude- und Freifläche, Wohnen</text>
        <text x="520" y="58" fill="#444">Aachener Straße 142</text>

        <text x="860" y="45" font-weight="bold">740 m²</text>
      </g>

      <!-- HINWEISKASTEN: SEITE 2 FEHLT (ABTEILUNG I EIGENTÜMER & ABTEILUNG II LASTEN) -->
      <g transform="translate(100, 480)">
        <rect width="1040" height="340" fill="#FFF9F7" stroke="#C0392B" stroke-width="2" stroke-dasharray="6,4" rx="8" />
        
        <circle cx="50" cy="50" r="24" fill="#E74C3C" />
        <text x="50" y="60" font-size="28" font-weight="bold" fill="#FFF" text-anchor="middle">!</text>

        <text x="95" y="45" font-size="18" font-weight="bold" fill="#900">ACHTUNG: DOKUMENTEN-FRAGMENT / FEHLENDE ABSCHNITTE</text>
        <text x="95" y="75" font-size="14" fill="#333">Die Folgeseite 2 des amtlichen Grundbuchblatts (Abteilung I: Eigentümer) wurde im Scan ausgelassen.</text>
        
        <line x1="30" y1="110" x2="1010" y2="110" stroke="#E0C0B8" stroke-width="1" />

        <text x="50" y="145" font-size="14" font-weight="bold" fill="#555">Fehlende Grundbuch-Bestandteile in dieser Ausfertigung:</text>
        
        <text x="70" y="180" font-size="14" fill="#222">• <tspan font-weight="bold">Abteilung I (Eigentümer):</tspan> Eigentumsverhältnisse und Erwerbsgrundlage NICHT ersichtlich.</text>
        <text x="70" y="215" font-size="14" fill="#222">• <tspan font-weight="bold">Abteilung II (Lasten &amp; Beschränkungen):</tspan> Wegerechte, Wohnungsrechte, Vormerkungen NICHT belegbar.</text>
        
        <rect x="50" y="250" width="940" height="60" fill="#FADBD8" rx="6" />
        <text x="70" y="285" font-size="13" font-weight="bold" fill="#78281F">Notarielle Handlungsanweisung (§ 21 BeurkG):</text>
        <text x="70" y="302" font-size="12" fill="#78281F">Unvollständige Grundbuchabschrift darf nicht zur Beurkundungsreife freigegeben werden. Vollständigen Auszug beiziehen.</text>
      </g>

      <!-- ABTEILUNG III (GRUNDSCHULDEN) AUF SEITE 3 -->
      <rect x="100" y="860" width="${width - 200}" height="35" fill="#E8ECE9" stroke="#333" stroke-width="1.5" />
      <text x="115" y="884" font-size="15" font-weight="bold">ABTEILUNG III (HYPOTHEKEN, GRUNDSCHULDEN, RENTENSCHULDEN)</text>

      <g transform="translate(100, 895)" font-size="13">
        <rect width="1040" height="120" fill="#FFFFFF" stroke="#333" stroke-width="1" />
        <text x="35" y="45" font-weight="bold">Lfd. Nr. 1:</text>
        <text x="140" y="45" font-weight="bold">280.000,00 EUR</text>
        <text x="300" y="45">Buchgrundschuld mit 18 % Jahreszinsen für die Sparkasse KölnBonn.</text>
        <text x="140" y="75" fill="#555">Eingetragen am 14.05.2018. Löschungsbewilligung liegt der Notarakte noch nicht bei.</text>
      </g>

      <!-- AMTLICHER STEMPEL & SIEGEL UNTEN RECHTS -->
      <g transform="translate(820, 1320)">
        <!-- Amtssiegel Kreis -->
        <circle cx="120" cy="120" r="85" fill="none" stroke="#1F4E79" stroke-width="3" opacity="0.8" />
        <circle cx="120" cy="120" r="76" fill="none" stroke="#1F4E79" stroke-width="1" opacity="0.6" stroke-dasharray="4,2" />
        
        <!-- Text im Kreis -->
        <path id="seal-text-path" d="M 45 120 A 75 75 0 0 1 195 120" fill="none" />
        <text font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#1F4E79" letter-spacing="3" text-anchor="middle">
          <textPath href="#seal-text-path" startOffset="50%">AMTSGERICHT KÖLN</textPath>
        </text>

        <!-- Wappen / Adler im Siegel -->
        <polygon points="120,70 100,105 140,105" fill="#1F4E79" opacity="0.7"/>
        <rect x="112" y="105" width="16" height="35" fill="#1F4E79" opacity="0.7"/>

        <text x="120" y="165" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#1F4E79" text-anchor="middle">GRUNDBUCHAMT</text>
        <text x="120" y="180" font-family="Arial, sans-serif" font-size="9" fill="#1F4E79" text-anchor="middle">• SIEGEL •</text>
      </g>

      <!-- Notarieller Eingangsvermerk links unten -->
      <g transform="translate(100, 1380)" font-family="'Courier New', monospace" font-size="13" fill="#2C3E50">
        <rect width="280" height="90" fill="none" stroke="#2C3E50" stroke-width="1.5" />
        <text x="15" y="25" font-weight="bold">NOTARIAT DR. WEBER</text>
        <text x="15" y="45">Eingegangen am: 11.03.2026</text>
        <text x="15" y="65">Aktenzeichen: 2026 / 184</text>
      </g>
    </g>

    <!-- Scan-Schatten -->
    <rect x="0" y="0" width="10" height="${height}" fill="#000" opacity="0.06" />
    <rect x="0" y="0" width="${width}" height="8" fill="#000" opacity="0.04" />
  </svg>
  `;

  const outputDir = path.resolve(process.cwd(), 'test-akten/fall-02-grundbuch-vollstaendigkeit');
  const pngPath = path.join(outputDir, 'Grundbuchauszug_Lindenthal.png');

  await sharp(Buffer.from(svgDocument))
    .rotate(-0.3, { background: '#FAF9F6' })
    .png({ quality: 92 })
    .toFile(pngPath);

  console.log(`✅ Amtlicher Grundbuch-Scan generiert: ${pngPath}`);
  console.log(
    `   - Tabellarisches Bestandsverzeichnis (AG Köln, Blatt 5412, Flurstück 88/2, 740 qm)`
  );
  console.log(`   - Warnkasten & fehlende Abteilung I`);
  console.log(`   - Amtssiegel & Notar-Eingangsstempel`);
}

generateAuthenticGrundbuchScan().catch(console.error);
