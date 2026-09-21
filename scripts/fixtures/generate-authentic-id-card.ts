import path from 'path';
import sharp from 'sharp';

/**
 * Erzeugt einen echten deutschen Personalausweis (Vorderseite nach Personalausweisgesetz / ICAO 9303)
 * mit:
 * 1. Bundesadler & EU-Sicherheitsmerkmalen
 * 2. Authentischem Passfoto (synthetische Silhouette / biometrisches Portraet)
 * 3. Klarem Notariats-relevanten Text (Name: MUSTERMANN, Vorname: ERIKA, Geburtsdatum, Gueltigkeit, Ausweis-Nr)
 * 4. Maschinenlesbarer Zone (MRZ / OCR-B Schriftart)
 * 5. Optionaler Unschärfe / Scan-Körnung (blur & noise)
 */
async function generateAuthenticIdCard(isBlurry: boolean, filename: string) {
  const width = 1012; // ID-1 Kartenformat (Standard 85.6 x 53.98 mm skaliert)
  const height = 638;

  const svgCard = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Sicherheits-Guillochen & Farbverlauf (Typischer Personalausweis-Hintergrund in Gruen/Rosa/Beige) -->
      <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#EBF4EE" />
        <stop offset="35%" stop-color="#F9EFF2" />
        <stop offset="70%" stop-color="#F2F5E8" />
        <stop offset="100%" stop-color="#E5EFF4" />
      </linearGradient>

      <pattern id="guilloche" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 0 20 Q 10 0 20 20 T 40 20" fill="none" stroke="#D3E2D8" stroke-width="0.8" opacity="0.6"/>
        <path d="M 0 10 Q 10 30 20 10 T 40 10" fill="none" stroke="#EAD4DB" stroke-width="0.8" opacity="0.6"/>
      </pattern>

      <!-- Passfoto-Farbfilter -->
      <linearGradient id="photo-bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#C5D0D8" />
        <stop offset="100%" stop-color="#9BAAB5" />
      </linearGradient>
    </defs>

    <!-- Kartenkoerper mit abgerundeten Ecken -->
    <rect width="${width}" height="${height}" rx="32" fill="url(#bg-grad)" stroke="#BAC5BE" stroke-width="2"/>
    <rect width="${width}" height="${height}" rx="32" fill="url(#guilloche)" />

    <!-- EU-Flagge & Header -->
    <rect x="45" y="38" width="60" height="40" rx="4" fill="#003399" />
    <text x="75" y="64" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#FFCC00" text-anchor="middle">D</text>

    <text x="125" y="52" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#1C3829" letter-spacing="1">BUNDESREPUBLIK DEUTSCHLAND</text>
    <text x="125" y="72" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#4B6354" letter-spacing="0.5">PERSONALAUSWEIS / IDENTITY CARD</text>

    <!-- Ausweisnummer oben rechts -->
    <text x="${width - 60}" y="52" font-family="'Courier New', monospace" font-size="13" fill="#666" text-anchor="end">Ausweis-Nr. / Doc. No.</text>
    <text x="${width - 60}" y="76" font-family="'Courier New', monospace" font-size="20" font-weight="bold" fill="#111" text-anchor="end">T22000129</text>

    <!-- ================= Biometrisches Foto (links) ================= -->
    <g transform="translate(50, 110)">
      <!-- Fotorahmen & Hintergrund -->
      <rect width="250" height="330" rx="12" fill="url(#photo-bg)" stroke="#8A9AA5" stroke-width="2"/>
      
      <!-- Biometrische Silhouette -->
      <!-- Kopf / Gesicht -->
      <ellipse cx="125" cy="140" rx="58" ry="75" fill="#D8B59E" />
      <!-- Haare -->
      <path d="M 62 135 C 55 70, 195 70, 188 135 C 175 90, 75 90, 62 135 Z" fill="#4A3425" />
      <!-- Augen -->
      <ellipse cx="102" cy="135" rx="7" ry="4" fill="#2E241E" />
      <ellipse cx="148" cy="135" rx="7" ry="4" fill="#2E241E" />
      <!-- Nase & Mund -->
      <path d="M 125 135 L 122 160 L 130 162" stroke="#B8937E" stroke-width="3" fill="none" />
      <line x1="110" y1="180" x2="140" y2="180" stroke="#9A6552" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Schultern / Kleidung (Dunkelblaues Sakko) -->
      <path d="M 15 330 C 25 240, 75 220, 125 220 C 175 220, 225 240, 235 330 Z" fill="#1D2A3A" />
      <!-- Hemdkragen -->
      <polygon points="125,220 105,260 145,260" fill="#FFFFFF" />

      <!-- Hologramm-Streifen ueber dem Foto (Adler) -->
      <circle cx="125" cy="170" r="45" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.3" stroke-dasharray="6,4"/>
    </g>

    <!-- ================= Ausweis-Felder (Mitte & Rechts) ================= -->
    <g font-family="Arial, Helvetica, sans-serif" fill="#222">
      <!-- 1. Name -->
      <text x="335" y="130" font-size="12" fill="#5E6D66">1. Name / Surname</text>
      <text x="335" y="156" font-size="20" font-weight="bold" letter-spacing="1">MUSTERMANN</text>

      <!-- 2. Vornamen -->
      <text x="335" y="190" font-size="12" fill="#5E6D66">2. Vornamen / Given names</text>
      <text x="335" y="214" font-size="18" font-weight="bold">ERIKA</text>

      <!-- 3. Staatsangehoerigkeit & Geburtsdatum -->
      <text x="335" y="250" font-size="12" fill="#5E6D66">3. Staatsangehoerigkeit</text>
      <text x="335" y="272" font-size="16" font-weight="bold">DEUTSCH</text>

      <text x="560" y="250" font-size="12" fill="#5E6D66">4. Geburtstag / Date of birth</text>
      <text x="560" y="272" font-size="16" font-weight="bold">12.08.1984</text>

      <!-- 4. Geburtsort -->
      <text x="335" y="308" font-size="12" fill="#5E6D66">5. Geburtsort / Place of birth</text>
      <text x="335" y="330" font-size="16" font-weight="bold">BERLIN</text>

      <!-- 5. Gueltig bis -->
      <text x="560" y="308" font-size="12" fill="#5E6D66">6. Gueltig bis / Date of expiry</text>
      <text x="560" y="330" font-size="16" font-weight="bold" fill="#A81D24">01.11.2030</text>

      <!-- Unterschrift -->
      <text x="335" y="375" font-size="12" fill="#5E6D66">7. Unterschrift des Inhabers / Signature</text>
      <!-- Realistische Unterschrift Erika Mustermann -->
      <path d="M 340 420 Q 355 385 365 425 Q 380 400 410 415 T 440 405 Q 460 380 475 425 Q 510 415 540 410" 
            stroke="#122442" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    </g>

    <!-- Bundesadler rechts dezent -->
    <path d="M 850 180 C 830 140, 930 140, 910 180 C 940 220, 930 300, 880 340 C 830 300, 820 220, 850 180 Z" 
          fill="#D6E2D8" opacity="0.45" />

    <!-- ================= Maschinenlesbare Zone (MRZ - ICAO 9303) ================= -->
    <!-- Weißer/Beiger Untergrund fuer MRZ -->
    <rect x="0" y="490" width="${width}" height="148" rx="0" fill="#F4F2EB" opacity="0.9" />
    <line x1="0" y1="490" x2="${width}" y2="490" stroke="#C2BEB4" stroke-width="1.5" />

    <!-- MRZ Text in OCR-B Standard Monospace -->
    <g font-family="'Courier New', Courier, monospace" font-size="28" font-weight="bold" fill="#1C1B1A" letter-spacing="4">
      <text x="50" y="538">IDD&lt;&lt;T220001293&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
      <text x="50" y="582">8408123F3011014D&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;4</text>
      <text x="50" y="626">MUSTERMANN&lt;&lt;ERIKA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    </g>
  </svg>
  `;

  const outputDir = path.resolve(process.cwd(), 'test-akten/fall-01-ausweis-pruefung');
  const outputPath = path.join(outputDir, filename);

  let sharpInstance = sharp(Buffer.from(svgCard));

  if (isBlurry) {
    sharpInstance = sharpInstance.blur(4.5).rotate(1.2, { background: '#D8D8D8' });
  }

  await sharpInstance.png({ quality: 90 }).toFile(outputPath);
  console.log(`✅ Ausweis generiert: ${outputPath}`);
}

async function main() {
  await generateAuthenticIdCard(true, 'Personalausweis_Scan.png');
  await generateAuthenticIdCard(false, 'Personalausweis_Referenz.png');
}

main().catch(console.error);
