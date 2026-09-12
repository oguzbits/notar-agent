import { Dossier, FieldStatus, SourceLocation, GenericFieldDossier } from '@/types/dossier';

export interface SubSourceItem {
  fileName: string;
  snippet?: string;
  pageNumber?: number;
}

export interface FieldObservation {
  fieldKey: string;
  fieldTitle: string;
  fieldIndex: number;
  status: FieldStatus;
  note: string;
  actionRequired?: string;
  source?: SourceLocation;
  sources: SubSourceItem[];
}

const IMMOBILIEN_FIELD_METADATA: Record<string, { title: string; index: number }> = {
  verkaeufer: { title: 'Verkäufer', index: 1 },
  kaeufer: { title: 'Käufer', index: 2 },
  grundbuch: { title: 'Grundbuch', index: 3 },
  grundstuecke: { title: 'Grundstücke', index: 4 },
  kaufpreis: { title: 'Kaufpreis', index: 5 },
  finanzierung: { title: 'Finanzierung', index: 6 },
  belastungen: { title: 'Belastungen (Abt. II & III)', index: 7 },
  mietverhaeltnisse: { title: 'Mietverhältnisse', index: 8 },
  energieausweis: { title: 'Energieausweis', index: 9 },
  uebergabe: { title: 'Übergabe', index: 10 },
};

/**
 * Registry für Feld-Metadaten je Vorgangstyp.
 * Erlaubt es, später nahtlos neue CaseTypes mit eigenen Pflichtfeldern zu registrieren.
 */
const CASE_TYPE_METADATA_REGISTRY: Record<
  string,
  Record<string, { title: string; index: number }>
> = {
  IMMOBILIENKAUF: IMMOBILIEN_FIELD_METADATA,
};

/**
 * Bereinigt Quellennamen (z.B. führende/nachfolgende Whitespaces).
 */
export function cleanSourceFileName(fileName: string): string {
  if (!fileName) return '';
  return fileName.trim();
}

/**
 * Zerlegt kombinierte Quellangaben (z.B. "grundbuch.pdf + makler.pdf" oder "Doc A; Doc B")
 * in strukturierte Einzeleinträge für saubere Badges und verhindert fehlerhaftes Aufspalten.
 */
export function parseSourceLocations(source?: SourceLocation): SubSourceItem[] {
  if (!source || !source.fileName || source.fileName.trim().length === 0) {
    return [];
  }

  // Zuerst bekannte Langbezeichnungen normalisieren
  const cleanedFileName = cleanSourceFileName(source.fileName);
  if (!cleanedFileName) {
    return [];
  }

  // Prüfen, ob echte Kombinationszeichen vorhanden sind
  const isCombined =
    cleanedFileName.includes('+') ||
    cleanedFileName.includes(';') ||
    /\s+und\s+/i.test(cleanedFileName) ||
    cleanedFileName.includes(',');

  if (!isCombined) {
    return [
      {
        fileName: cleanedFileName,
        snippet: source.snippet || undefined,
        pageNumber: source.pageNumber && source.pageNumber > 0 ? source.pageNumber : undefined,
      },
    ];
  }

  // Teile aufspalten und bereinigen
  const rawParts = cleanedFileName
    .split(/\s*\+\s*|\s*;\s*|\s+und\s+|\s*,\s*/i)
    .map((p) => cleanSourceFileName(p.trim()))
    .filter((p) => p.length > 0);

  // Duplikate entfernen (z.B. falls die gleiche Notiz mehrfach genannt wurde)
  const seen = new Set<string>();
  const fileParts: string[] = [];
  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      fileParts.push(part);
    }
  }

  if (fileParts.length <= 1) {
    return [
      {
        fileName: fileParts[0] || cleanedFileName,
        snippet: source.snippet || undefined,
        pageNumber: source.pageNumber && source.pageNumber > 0 ? source.pageNumber : undefined,
      },
    ];
  }

  const snippet = source.snippet || undefined;

  return fileParts.map((fName) => ({
    fileName: fName,
    snippet,
    pageNumber: source.pageNumber && source.pageNumber > 0 ? source.pageNumber : undefined,
  }));
}

/**
 * Sammelt alle konkreten Feststellungen, Prüfhinweise und Handlungsempfehlungen
 * aus den Pflichtfeldern eines Dossiers inklusive aller aufgelösten Quellen.
 */
export function extractFieldObservations(dossier: Dossier): FieldObservation[] {
  if (!dossier?.fields) return [];

  const metaMap =
    (dossier.caseType && CASE_TYPE_METADATA_REGISTRY[dossier.caseType]) ||
    IMMOBILIEN_FIELD_METADATA;

  const observations: FieldObservation[] = [];

  const fieldsObj = dossier.fields as unknown as Record<
    string,
    GenericFieldDossier<Record<string, unknown>>
  >;

  for (const [key, field] of Object.entries(fieldsObj)) {
    if (!field) continue;

    const meta = metaMap[key] || { title: key, index: 99 };
    const note = (field.note || '').trim();
    const action = (field.actionRequired || '').trim();
    const status: FieldStatus = field.status || 'MISSING';

    const hasExplicitNote = note.length > 0;
    const hasAction = action.length > 0;
    const isProblematicStatus = status !== 'VERIFIED';

    if (hasExplicitNote || hasAction || isProblematicStatus) {
      let resolvedNote = note;
      if (!resolvedNote) {
        if (status === 'MISSING')
          resolvedNote = 'Erforderliche Nachweise fehlen bisher im Aktenbestand.';
        else if (status === 'OUTDATED')
          resolvedNote = 'Die vorgelegten Unterlagen sind veraltet oder abgelaufen.';
        else if (status === 'NEEDS_REVIEW')
          resolvedNote = 'Prüfung bzw. sachliche Klärung erforderlich.';
      }

      const sources = parseSourceLocations(field.source);

      observations.push({
        fieldKey: key,
        fieldTitle: meta.title,
        fieldIndex: meta.index,
        status,
        note: resolvedNote,
        actionRequired: hasAction ? action : undefined,
        source: field.source && field.source.fileName ? field.source : undefined,
        sources,
      });
    }
  }

  // Nach Feld-Reihenfolge sortieren
  return observations.sort((a, b) => a.fieldIndex - b.fieldIndex);
}

/**
 * Gibt ALLE Pflichtfelder eines Dossiers in tabellarischer Form zurück
 * (sowohl belegte als auch prüfbedürftige).
 */
export function extractAllFieldRows(dossier: Dossier): FieldObservation[] {
  if (!dossier?.fields) return [];

  const metaMap =
    (dossier.caseType && CASE_TYPE_METADATA_REGISTRY[dossier.caseType]) ||
    IMMOBILIEN_FIELD_METADATA;

  const rows: FieldObservation[] = [];

  const fieldsObj = dossier.fields as unknown as Record<
    string,
    GenericFieldDossier<Record<string, unknown>>
  >;

  for (const [key, field] of Object.entries(fieldsObj)) {
    if (!field) continue;

    const meta = metaMap[key] || { title: key, index: 99 };
    const note = (field.note || '').trim();
    const action = (field.actionRequired || '').trim();
    const status: FieldStatus = field.status || 'MISSING';

    let resolvedNote = note;
    if (!resolvedNote) {
      if (status === 'VERIFIED') resolvedNote = 'Vollständig geprüft & durch Aktenbestand belegt.';
      else if (status === 'MISSING')
        resolvedNote = 'Erforderliche Nachweise fehlen bisher im Aktenbestand.';
      else if (status === 'OUTDATED')
        resolvedNote = 'Die vorgelegten Unterlagen sind veraltet oder abgelaufen.';
      else if (status === 'NEEDS_REVIEW')
        resolvedNote = 'Prüfung bzw. sachliche Klärung erforderlich.';
    }

    const sources = parseSourceLocations(field.source);

    rows.push({
      fieldKey: key,
      fieldTitle: meta.title,
      fieldIndex: meta.index,
      status,
      note: resolvedNote,
      actionRequired: action || undefined,
      source: field.source && field.source.fileName ? field.source : undefined,
      sources,
    });
  }

  return rows.sort((a, b) => a.fieldIndex - b.fieldIndex);
}

const STATUS_LABELS_DE: Record<FieldStatus, string> = {
  VERIFIED: 'Belegt',
  NEEDS_REVIEW: 'Prüfung nötig',
  OUTDATED: 'Veraltet',
  MISSING: 'Fehlt',
};

/**
 * Generiert einen kompakten Textbericht für die Zwischenablage.
 */
export function generatePruefberichtText(dossier: Dossier): string {
  const isReady = isDossierEntwurfsreif(dossier);
  const statusLabel = isReady ? 'ENTWURFSREIF' : 'PRÜFUNGSBEDARF';
  const observations = extractFieldObservations(dossier);

  const lines: string[] = [
    `=== PRÜFBERICHT & FESTSTELLUNGEN ===`,
    `Vorgang: ${dossier.caseTitle}`,
    `Status: ${statusLabel}`,
    `Datum: ${new Date().toLocaleDateString('de-DE')}`,
    ``,
  ];

  if (dossier.executiveSummary) {
    lines.push(`Gesamteinschätzung:`, `${dossier.executiveSummary}`, ``);
  }

  if (observations.length === 0) {
    lines.push(`Feststellungen: Alle Pflichtfelder vollständig belegt.`);
  } else {
    lines.push(`Feststellungen (${observations.length}):`);
    for (const obs of observations) {
      const sourceStr =
        obs.sources.length > 0
          ? obs.sources
              .map((s) => `${s.fileName}${s.pageNumber ? ` (S. ${s.pageNumber})` : ''}`)
              .join('; ')
          : 'Kein Beleg im Aktenbestand';

      const germanStatus = STATUS_LABELS_DE[obs.status] || obs.status;
      lines.push(`[${obs.fieldIndex}] ${obs.fieldTitle} [${germanStatus}]: ${obs.note}`);
      lines.push(`    Quelle: ${sourceStr}`);
      if (obs.actionRequired) {
        lines.push(`    Empfehlung: ${obs.actionRequired}`);
      }
      if (obs.source?.snippet) {
        lines.push(`    Zitat: "${obs.source.snippet}"`);
      }
      lines.push(``);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Prüft, ob ein Dossier vollständig entwurfsreif ist.
 */
export function isDossierEntwurfsreif(dossier: Dossier): boolean {
  if (!dossier?.fields) return false;

  const fieldValues = Object.values(
    dossier.fields as unknown as Record<string, GenericFieldDossier<Record<string, unknown>>>
  );
  if (fieldValues.length === 0) return false;

  const allFieldsVerified = fieldValues.every((f) => f && f.status === 'VERIFIED');
  return allFieldsVerified;
}

export type ReadinessStage = 'READY' | 'DRAFTING_POSSIBLE' | 'BLOCKED';

export interface ReadinessInfo {
  stage: ReadinessStage;
  badgeLabel: string;
  badgeClass: string;
  dotColor: string;
  description: string;
}

/**
 * Registry für elementare Kernfelder je Vorgangstyp (müssen belegt sein für Entwurfserstellung).
 */
const CASE_TYPE_CORE_FIELDS: Record<string, { partyFields: string[]; objectFields: string[] }> = {
  IMMOBILIENKAUF: {
    partyFields: ['verkaeufer', 'kaeufer'],
    objectFields: ['kaufpreis', 'grundbuch'],
  },
};

/**
 * Ermittelt eine praxisnahe notarielle Reifestufe:
 * - READY (Vollständig beurkundungsreif): Alle Pflichtfelder verifiziert
 * - DRAFTING_POSSIBLE (Entwurfserstellung möglich): Die Kerndaten (Parteien, Objekt, Gegenleistung) stehen fest
 * - BLOCKED (Klärung vor Entwurf): Elementare Kernangaben fehlen
 */
export function getDossierReadinessStage(dossier: Dossier): ReadinessInfo {
  if (isDossierEntwurfsreif(dossier)) {
    return {
      stage: 'READY',
      badgeLabel: 'Beurkundungsreif',
      badgeClass: 'border-[#B9ED94] bg-[#E7F9DA] text-[#284E0D]',
      dotColor: '#356611',
      description: 'Alle notariellen Pflichtfelder sind vollständig belegt.',
    };
  }

  // Generische Kerndaten-Prüfung anhand des Vorgangstyps
  const fields = dossier.fields as
    Record<string, GenericFieldDossier<Record<string, unknown>>> | undefined;
  const caseType = dossier.caseType || 'IMMOBILIENKAUF';
  const coreConfig = CASE_TYPE_CORE_FIELDS[caseType] || CASE_TYPE_CORE_FIELDS.IMMOBILIENKAUF;

  const partyOk = coreConfig.partyFields.some((key) => fields?.[key]?.status === 'VERIFIED');
  const objectOk = coreConfig.objectFields.some((key) => fields?.[key]?.status === 'VERIFIED');

  if (partyOk && objectOk) {
    return {
      stage: 'DRAFTING_POSSIBLE',
      badgeLabel: 'Entwurfserstellung möglich',
      badgeClass:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
      dotColor: '#059669',
      description:
        'Wesentliche Vertragsdaten liegen vor. Begleitfragen können parallel geklärt werden.',
    };
  }

  return {
    stage: 'BLOCKED',
    badgeLabel: 'Nachforderung erforderlich',
    badgeClass:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    dotColor: '#d97706',
    description: '',
  };
}

/**
 * Normalisiert ein Dossier vollumfänglich:
 * - Bereinigt überlange Quellennamen (z.B. "Ergänzende Sachverhalts- und Bearbeitungshinweise") zu "Notiz #1"
 * - Stellt sicher, dass zitierte Notizen auch in "detectedDocuments" (Vorgelegte Unterlagen) auftauchen
 * - Verhindert doppelte oder gesplittete Notizeinträge
 */
export function normalizeDossier(dossier: Dossier, additionalNoteTexts?: string[]): Dossier {
  if (!dossier) return dossier;

  const cloned: Dossier = JSON.parse(JSON.stringify(dossier));

  // 1. Felder bereinigen (source.fileName normalisieren)
  const referencedNotes = new Map<string, string>(); // noteId -> sample snippet

  if (cloned.fields && typeof cloned.fields === 'object') {
    const fieldsObj = cloned.fields as unknown as Record<
      string,
      GenericFieldDossier<Record<string, unknown>>
    >;
    for (const field of Object.values(fieldsObj)) {
      if (field && field.source && field.source.fileName) {
        const originalName = field.source.fileName;
        const cleaned = cleanSourceFileName(originalName);
        if (cleaned !== originalName) {
          field.source.fileName = cleaned;
        }

        // Falls eine Notiz referenziert wird, merken
        const subSources = parseSourceLocations(field.source);
        for (const sub of subSources) {
          if (sub.fileName.toLowerCase().startsWith('notiz')) {
            if (!referencedNotes.has(sub.fileName) && (sub.snippet || field.source.snippet)) {
              referencedNotes.set(sub.fileName, sub.snippet || field.source.snippet || '');
            }
          }
        }
      }
    }

    // 1b. Generische Konsistenz-Guardrail: Ein Feld darf niemals 'VERIFIED' sein, wenn das data-Objekt leer ist
    for (const field of Object.values(fieldsObj)) {
      if (field && field.status === 'VERIFIED') {
        const d = field.data;
        const hasValues =
          d &&
          typeof d === 'object' &&
          Object.values(d).some((v) => {
            if (v === null || v === undefined || v === '') return false;
            if (Array.isArray(v) && v.length === 0) return false;
            if (typeof v === 'number' && v === 0) return false;
            if (typeof v === 'boolean' && v === false) return false;
            return true;
          });
        if (!hasValues) {
          field.status = 'NEEDS_REVIEW';
          if (!field.note) {
            field.note = 'Angaben unvollständig – Datenwert zur Beurkundung erforderlich.';
          }
        }
      }
    }

    // 1c. Notarielle Fach-Guardrails (Eigentümeridentität & Registerbelege)
    const verkaeuferField = fieldsObj['verkaeufer'];
    if (verkaeuferField && verkaeuferField.status === 'VERIFIED' && verkaeuferField.data) {
      const vData = verkaeuferField.data as {
        name?: string;
        legalForm?: string;
        registeredOwnersGrundbuch?: string[];
        representationProofProvided?: boolean;
      };

      // Wenn im Grundbuch abweichende Eigentümer eingetragen sind und keine Vertretung nachgewiesen ist
      if (
        Array.isArray(vData.registeredOwnersGrundbuch) &&
        vData.registeredOwnersGrundbuch.length > 0 &&
        vData.name
      ) {
        const vNameClean = vData.name.toLowerCase().trim();
        const matchesOwner = vData.registeredOwnersGrundbuch.some((owner) => {
          const oClean = owner.toLowerCase().trim();
          return oClean.includes(vNameClean) || vNameClean.includes(oClean);
        });

        if (!matchesOwner && !vData.representationProofProvided) {
          verkaeuferField.status = 'NEEDS_REVIEW';
          verkaeuferField.note =
            'Eigentümer lt. Grundbuch weicht vom handelnden Verkäufer ab – Erbnachweis (§ 35 GBO) oder Vollmacht erforderlich.';
        }
      }

      // Bei juristischen Personen ohne Vertretungsnachweis
      const isCorporate =
        vData.legalForm &&
        !['natürliche person', 'privatperson', 'einzelperson'].includes(
          vData.legalForm.toLowerCase().trim()
        );
      if (isCorporate && vData.representationProofProvided === false) {
        verkaeuferField.status = 'NEEDS_REVIEW';
        if (!verkaeuferField.note) {
          verkaeuferField.note =
            'Vertretungsnachweis der Gesellschaft vor Beurkundung erforderlich (§ 12 HGB, § 21 BNotO).';
        }
      }
    }

    const kaeuferField = fieldsObj['kaeufer'];
    if (kaeuferField && kaeuferField.status === 'VERIFIED' && kaeuferField.data) {
      const kData = kaeuferField.data as {
        legalForm?: string;
        hasOfficialRegisterProof?: boolean;
      };
      const isCorporate =
        kData.legalForm &&
        !['natürliche person', 'privatperson', 'einzelperson'].includes(
          kData.legalForm.toLowerCase().trim()
        );
      if (isCorporate && kData.hasOfficialRegisterProof === false) {
        kaeuferField.status = 'NEEDS_REVIEW';
        if (!kaeuferField.note) {
          kaeuferField.note =
            'Amtlicher Registerauszug der Käufergesellschaft fehlt bisher im Aktenbestand.';
        }
      }
    }
  }

  // 2. detectedDocuments bereinigen
  if (!Array.isArray(cloned.detectedDocuments)) {
    cloned.detectedDocuments = [];
  }

  // Dateinamen in detectedDocuments trimmen
  for (const doc of cloned.detectedDocuments) {
    if (doc && doc.fileName) {
      doc.fileName = doc.fileName.trim();
    }
  }

  // 3. userNotes zusammenführen und pflegen
  const existingNotes: string[] = Array.isArray(cloned.userNotes) ? [...cloned.userNotes] : [];

  if (Array.isArray(additionalNoteTexts)) {
    for (const text of additionalNoteTexts) {
      const trimmed = text.trim();
      if (trimmed && !existingNotes.includes(trimmed)) {
        existingNotes.push(trimmed);
      }
    }
  }

  // Falls userNotes noch leer ist, aus referenzierten Notizen oder bestehenden Vermerken extrahieren
  if (existingNotes.length === 0) {
    for (const snippet of referencedNotes.values()) {
      if (snippet && snippet.trim().length > 0 && !existingNotes.includes(snippet.trim())) {
        existingNotes.push(snippet.trim());
      }
    }
  }

  cloned.userNotes = existingNotes;

  const todayIso = cloned.analysisTimestamp
    ? cloned.analysisTimestamp.split('T')[0]
    : new Date().toISOString().split('T')[0];

  // 4. In detectedDocuments sicherstellen, dass jede Notiz mit ihrem 1:1 Originaltext vorliegt
  // Bestehende Nicht-Notiz Dokumente filtern
  const nonNoteDocs = cloned.detectedDocuments.filter(
    (d) =>
      !d.fileName.toLowerCase().startsWith('notiz') &&
      !d.documentType.toLowerCase().includes('notiz') &&
      !d.documentType.toLowerCase().includes('bearbeitungshinweis')
  );

  const noteDocs: typeof cloned.detectedDocuments = [];

  existingNotes.forEach((noteText, idx) => {
    const noteName = `Notiz #${idx + 1}`;
    noteDocs.push({
      fileName: noteName,
      documentType: 'Bearbeitungsvermerk / Notiz',
      date: todayIso,
      pageCount: 1,
      reliability: 'LOW',
      summary: noteText, // 1:1 unverkürzter Originaltext, NIEMALS zusammengefasst
    });
  });

  // Notizen ganz oben anstellen, damit der Nutzer sie sofort sieht
  cloned.detectedDocuments = [...noteDocs, ...nonNoteDocs];

  return cloned;
}
