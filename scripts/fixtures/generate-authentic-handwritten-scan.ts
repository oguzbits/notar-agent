import path from 'path';
import sharp from 'sharp';

/**
 * Erzeugt einen echten, authentischen DIN A4-Scan (1240 x 1754 px)
 * mit:
 * 1. Gedrucktem Notar-Vertragstext (Antiqua / Serif Font)
 * 2. Echter Kugelschreiber-Durchstreichung des alten Kaufpreises (blaue Tinte)
 * 3. Handschriftlich gekritzeltem neuem Kaufpreis am rechten Rand ("425.000 €")
 * 4. Notar-Paraphe / Kuerzel
 * 5. Typischen Scan-Artefakten (Papier-Korn, leichter Grauschleier, Kantenrauschen)
 */
async function generateAuthenticHandwrittenScan() {
  const width = 1240;
  const height = 1754;

  const svgDocument = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Papier-Muster / Textur -->
      <filter id="paper-texture" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
        <feColorMatrix type="matrix" values="0.1 0 0 0 0.96   0 0.1 0 0 0.95   0 0 0.1 0 0.93  0 0 0 1 0" />
      </filter>

      <!-- Kugelschreiber-Unregelmaessigkeit -->
      <filter id="pen-ink" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>

    <!-- Papier Hintergrund -->
    <rect width="${width}" height="${height}" fill="#FAF8F5" />
    <rect width="${width}" height="${height}" filter="url(#paper-texture)" opacity="0.35" />

    <!-- Notar Briefkopf & Header -->
    <g font-family="Times New Roman, serif" fill="#1C1B1A">
      <text x="120" y="160" font-size="20" font-weight="bold" letter-spacing="1">NOTAR DR. JOHANNES WEBER</text>
      <text x="120" y="190" font-size="14" fill="#555">Sitz in Koeln • Hohenzollernring 42, 50672 Koeln</text>
      <line x1="120" y1="210" x2="1120" y2="210" stroke="#777" stroke-width="1" />

      <text x="120" y="270" font-size="16" font-weight="bold">URKUNDENROLLE NR. 2026 / 184</text>
      <text x="120" y="320" font-size="24" font-weight="bold">GRUNDSTUECKSKAUFVERTRAG</text>

      <text x="120" y="380" font-size="16">Verhandelt zu Koeln am 12. Maerz 2026 vor dem unterzeichnenden Notar.</text>
      <text x="120" y="420" font-size="16">Erschienen sind heute:</text>

      <text x="150" y="460" font-size="16">1. Frau Dr. Elena Rostova, geb. 14.05.1978, Beethovenstr. 12, Koeln</text>
      <text x="180" y="485" font-size="14" fill="#444">- nachstehend &quot;Verkaeuferin&quot; genannt -</text>

      <text x="150" y="530" font-size="16">2. Herr Marc Albrecht, geb. 22.09.1981, Venloer Str. 88, Koeln</text>
      <text x="180" y="555" font-size="14" fill="#444">- nachstehend &quot;Kaeufer&quot; genannt -</text>

      <text x="120" y="630" font-size="18" font-weight="bold">§ 1 Vertragsgegenstand</text>
      <text x="120" y="670" font-size="16">Im Grundbuch des Amtsgerichts Koeln von Lindenthal, Blatt 5412, eingetragenes</text>
      <text x="120" y="700" font-size="16">Grundstueck der Gemarkung Lindenthal, Flur 7, Flurstueck 88/2 zu 740 qm.</text>

      <text x="120" y="770" font-size="18" font-weight="bold">§ 2 Kaufpreis und Zahlungsfaelligkeit</text>
      <text x="120" y="810" font-size="16">(1) Der Kaufpreis fuer den vorstehend naeher bezeichneten Grundbesitz betraegt</text>
      
      <!-- Der gedruckte Kaufpreis, der spaeter durchgestrichen wird -->
      <text id="printed-price" x="150" y="860" font-size="19" font-weight="bold">EUR 450.000,00</text>
      <text x="320" y="860" font-size="16">(in Worten: Euro vierhundertfuenfzigtausend).</text>

      <text x="120" y="920" font-size="16">(2) Der Kaufpreis ist faellig binnen 14 Tagen nach Mitteilung des Notars ueber das</text>
      <text x="120" y="950" font-size="16">Vorliegen der gesetzlichen Faelligkeitsvoraussetzungen.</text>
    </g>

    <!-- ============================================================== -->
    <!-- HANDSCHRIFTLICHE KORREKTUREN & STIFT-NOTIZEN (Kugelschreiber-Blau) -->
    <!-- ============================================================== -->
    <g filter="url(#pen-ink)">
      <!-- 1. Energische Kugelschreiber-Durchstreichung des alten Kaufpreises "450.000,00" -->
      <!-- Zittriger Mehrfach-Strich ueber "EUR 450.000,00" (x: 145 bis 305, y um 854) -->
      <path d="M 142 856 Q 220 852 308 855" stroke="#103B7B" stroke-width="2.6" fill="none" opacity="0.92" stroke-linecap="round"/>
      <path d="M 145 852 Q 225 855 306 851" stroke="#0E3269" stroke-width="2.2" fill="none" opacity="0.88" stroke-linecap="round"/>
      <path d="M 148 858 Q 210 850 302 856" stroke="#1A4A94" stroke-width="1.8" fill="none" opacity="0.85" stroke-linecap="round"/>

      <!-- 2. Handschriftlicher Pfeil & Randvermerk nach rechts -->
      <path d="M 312 853 Q 360 840 420 846 Q 480 850 540 838" stroke="#103B7B" stroke-width="2.1" fill="none" opacity="0.9" stroke-linecap="round"/>
      <path d="M 530 830 L 545 838 L 532 846" stroke="#103B7B" stroke-width="2.2" fill="none" opacity="0.9" stroke-linecap="round"/>

      <!-- 3. Handschriftlich gekritzelt: "425.000,- €" (Mit echten Vektor-Linienzuegen fuer Handschrift) -->
      <!-- Zahl '4' -->
      <path d="M 575 825 L 565 850 L 592 849" stroke="#123B7C" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 584 818 L 582 862" stroke="#123B7C" stroke-width="2.7" fill="none" stroke-linecap="round"/>

      <!-- Zahl '2' -->
      <path d="M 602 830 Q 618 816 626 828 Q 624 842 602 860 L 632 860" stroke="#103875" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Zahl '5' -->
      <path d="M 648 824 L 642 840 Q 662 836 662 850 Q 660 862 640 861" stroke="#123B7C" stroke-width="2.7" fill="none" stroke-linecap="round"/>
      <path d="M 646 824 L 664 823" stroke="#123B7C" stroke-width="2.5" fill="none" stroke-linecap="round"/>

      <!-- Punkt '.' -->
      <circle cx="672" cy="858" r="2" fill="#103875" />

      <!-- Null '0' -->
      <ellipse cx="688" cy="844" rx="7" ry="16" stroke="#103875" stroke-width="2.6" fill="none" transform="rotate(-6 688 844)" />
      <!-- Null '0' -->
      <ellipse cx="708" cy="843" rx="7" ry="16" stroke="#123B7C" stroke-width="2.6" fill="none" transform="rotate(-4 708 843)" />
      <!-- Null '0' -->
      <ellipse cx="728" cy="843" rx="7" ry="16" stroke="#0E3269" stroke-width="2.6" fill="none" transform="rotate(-5 728 843)" />

      <!-- Strich und Euro ",- €" -->
      <path d="M 742 852 L 754 844" stroke="#123B7C" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M 778 834 Q 762 830 760 844 Q 762 858 778 856" stroke="#103875" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <line x1="755" y1="841" x2="774" y2="841" stroke="#103875" stroke-width="2.2" />
      <line x1="755" y1="847" x2="774" y2="847" stroke="#103875" stroke-width="2.2" />

      <!-- Randvermerk Text handschriftlich: "gemaess Muendlicher Absprache v. 12.03." -->
      <!-- Handschriftlicher Schriftzug als unregelmaessiger Pfad + Text im Handwriting-Stil -->
      <g font-family="Brush Script MT, 'Segoe Script', cursive, sans-serif" font-size="21" fill="#103A78" transform="rotate(-2 600 890)">
        <text x="560" y="900">gemaess Absprache geaendert!</text>
        <text x="560" y="928">12.03.2026</text>
      </g>

      <!-- Notarielle Paraphe (Kuerzel mit Schnoerkel) -->
      <path d="M 730 905 Q 750 880 765 925 Q 770 940 790 910 Q 805 890 815 930" stroke="#0D2E62" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <circle cx="825" cy="925" r="2.5" fill="#0D2E62" />
    </g>

    <!-- Typische Scan-Spur: Dunklere Kante links / leichter Schatten am Rand -->
    <rect x="0" y="0" width="12" height="${height}" fill="#000" opacity="0.08" />
    <rect x="0" y="0" width="${width}" height="10" fill="#000" opacity="0.05" />
  </svg>
  `;

  const outputDir = path.resolve(process.cwd(), 'test-akten/fall-03-vertragsaenderung-handschrift');
  const pngPath = path.join(outputDir, 'Kaufvertrag_Scan.png');

  await sharp(Buffer.from(svgDocument))
    .rotate(0.4, { background: '#FAF8F5' })
    .png({ quality: 90 })
    .toFile(pngPath);

  console.log(`✅ Echtes Scan-Bild generiert: ${pngPath}`);
  console.log(`   - Auflösung: ${width}x${height} (DIN A4 Scan)`);
  console.log(`   - Kugelschreiber-Tinte (Blau) mit Vektor-Stiftpfaden`);
  console.log(`   - Durchstreichung über 'EUR 450.000,00'`);
  console.log(`   - Handschriftliche Randnotiz '425.000,- €' mit Paraphe`);
  console.log(`   - 0.4° Scanner-Schiefstand und Papier-Körnung.`);
}

generateAuthenticHandwrittenScan().catch(console.error);
