import { generateText, LanguageModel, SystemModelMessage } from 'ai';
import { cleanAndParseJson } from '@/lib/ai/parsers/clean-json';
import { createEmptyImmobilienFields } from '@/lib/dossier-defaults';
import { normalizeDossier } from '@/lib/dossier-helpers';
import {
  CaseType,
  Dossier,
  DetectedDocument,
  ImmobilienDossierSchema,
  GenericFieldDossier,
  ImmobilienFields,
  Inquiry,
} from '@/types/dossier';

export interface UploadedFilePayload {
  name: string;
  type: string;
  size: number;
  content?: string;
  isBase64?: boolean;
}

export interface PipelineParams {
  files: UploadedFilePayload[];
  caseType: CaseType;
  notes: string;
  existingDossier?: Dossier;
  model: LanguageModel;
  extractionInstructions: SystemModelMessage;
  auditorInstructions: SystemModelMessage;
  onStep: (step: number, stepDetail: string) => void;
}

export async function runAnalysisPipeline(params: PipelineParams): Promise<Dossier> {
  const {
    files,
    caseType,
    notes,
    existingDossier,
    model,
    extractionInstructions,
    auditorInstructions,
    onStep,
  } = params;

  const todayStr = new Date().toISOString().split('T')[0];
  let contextHeader = `Heutiges Bearbeitungsdatum: ${todayStr}\n`;
  if (files.length > 0) {
    contextHeader += `Bitte analysiere die folgenden ${files.length} neu eingereichten Dokumente für die notarielle Zuarbeit.\n`;
  } else {
    contextHeader += `Bitte aktualisiere das bestehende Dossier anhand der folgenden neuen Sachverhalts- und Bearbeitungshinweise.\n`;
  }
  contextHeader += `VORGANGSTYP: ${caseType}\n\n`;

  if (existingDossier) {
    contextHeader += `=== BEREITS BESTEHENDES VORGANGS-DOSSIER ZUR AKTUALISIERUNG ===
Aktenzeichen / Titel: ${existingDossier.caseTitle}
Bisheriger Gesamtstatus: ${existingDossier.overallStatus}
Bisher erkannte Dokumente: ${existingDossier.detectedDocuments.map((d: DetectedDocument) => `"${d.fileName}" (${d.documentType})`).join(', ')}

ANWEISUNG ZUR AKTUALISIERUNG / NACHREICHUNG (DELTA-MODUS):
1. Prüfe die neu eingereichten Dokumente bzw. Notizen zielgerichtet darauf, ob sie bestehende Lücken (MISSING / NEEDS_REVIEW) schließen.
2. EFFIZIENZ: Gib im "fields"-Objekt AUSSCHLIESSLICH diejenigen Felder aus, die durch die neuen Unterlagen neu verifiziert, korrigiert oder ergänzt werden! Felder, an denen sich durch die neuen Unterlagen nichts ändert, LÄSST DU IM JSON EINFACH WEG. Unser System übernimmt bisherige Stände automatisch.
3. Führe die Liste der erkannten Dokumente (detectedDocuments) fort (vorherige Dokumente + neu eingereichte Dokumente).
4. Aktualisiere offene Nachforderungen (inquiries) – erledigte Punkte entfernen oder als resolved markieren.
\n`;
  }

  const noteList = notes
    .split('\n\n')
    .map((n) => n.trim())
    .filter(Boolean);

  let notesSection = '';
  if (noteList.length > 0) {
    const existingNoteCount =
      existingDossier?.detectedDocuments?.filter((d: DetectedDocument) =>
        d.fileName.toLowerCase().startsWith('notiz')
      ).length || 0;

    const formattedNotes = noteList
      .map((text, i) => `[Notiz #${existingNoteCount + i + 1}]: "${text}"`)
      .join('\n');

    notesSection = `=== INTERNE NOTIZEN / BEARBEITUNGSVERMERKE DER SACHBEARBEITUNG ===
${formattedNotes}
(WICHTIGE ANWEISUNG FÜR QUELLEN UND DOKUMENTE:
- Belege aus diesen Notizen MÜSSEN als source.fileName prägnant den Bezeichner "Notiz #${existingNoteCount + 1}" (bzw. die entsprechende Nummer) erhalten.
- Jede dieser Notizen MUSS zwingend auch in 'detectedDocuments' als Typ "Bearbeitungsvermerk / Notiz" mit aktuellem Tagesdatum aufgeführt werden.
- Fasse diese Notizen NIEMALS zusammen oder kürze sie ab! Der Text muss exakt 1:1 im vollen Originalwortlaut wiedergegeben werden.)\n\n`;
  }

  contextHeader += `Führe die Zuarbeit streng gemäß deinen Richtlinien durch:
- Setze caseType auf "${caseType}".
- Identifiziere jedes Dokument mit Datum und Verlässlichkeit ('HIGH', 'MEDIUM', 'LOW', 'OBSOLETE', 'UNRELATED').
- Prüfe jedes der 10 Pflichtfelder mit vollständigem Audit Trail (fileName + snippet).
- Extrahiere alle im Aktenbestand nachweisbaren Datenpunkte sachlich, vollständig und präzise.
- Setze den Status (VERIFIED, NEEDS_REVIEW, OUTDATED, MISSING) objektiv anhand der vorliegenden Belege und Gültigkeiten.
- Erstelle strukturierte Nachforderungen an zuständige Beteiligte ausschließlich für echte, unverzichtbare Lücken.

${notesSection}${
    files.length > 0
      ? 'Eingereichte Dateien im Vorgang:\n' +
        files
          .map(
            (f, i) =>
              `[Dokument #${i + 1}]: "${f.name}" (${f.type || 'unbekannt'}, ${Math.round(f.size / 1024)} KB)`
          )
          .join('\n') +
        '\n\n--- DOKUMENTENINHALTE (ALLE DATEIEN SORGFÄLTIG UND VOLLSTÄNDIG PRÜFEN) ---\n'
      : ''
  }`;

  const userPromptParts: Array<
    | { type: 'text'; text: string }
    | { type: 'file'; data: string; mediaType: string; filename?: string }
  > = [
    {
      type: 'text',
      text: contextHeader,
    },
  ];

  for (const file of files) {
    if (file.isBase64 && file.type.startsWith('image/')) {
      const rawBase64 = (file.content || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      userPromptParts.push({
        type: 'file',
        data: rawBase64,
        mediaType: file.type,
        filename: file.name,
      });
      userPromptParts.push({
        type: 'text',
        text: `\n[Obiges Bild gehört zu Datei: "${file.name}"]\n`,
      });
    } else if (
      file.isBase64 &&
      (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
    ) {
      const rawBase64 = (file.content || '').replace(/^data:application\/pdf;base64,/, '');
      userPromptParts.push({
        type: 'file',
        data: rawBase64,
        mediaType: 'application/pdf',
        filename: file.name,
      });
      userPromptParts.push({
        type: 'text',
        text: `\n[Obiges PDF-Dokument: "${file.name}"]\n`,
      });
    } else if (file.content) {
      userPromptParts.push({
        type: 'text',
        text: `\n=== START DATEI: "${file.name}" ===\n${file.content}\n=== ENDE DATEI: "${file.name}" ===\n`,
      });
    } else {
      userPromptParts.push({
        type: 'text',
        text: `\n=== DATEI: "${file.name}" (Metadaten vorhanden) ===\n`,
      });
    }
  }

  // =========================================================================
  // STUFE 1: Ingestion & Extraction Agent
  // =========================================================================
  onStep(1, 'Stufe 1: Urkunden- & Sachverhaltserfassung läuft...');

  const { text: extractionText } = await generateText({
    model,
    instructions: extractionInstructions,
    messages: [
      {
        role: 'user',
        content: userPromptParts,
      },
    ],
    temperature: 0.1,
  });

  const parsedExtractionRaw = cleanAndParseJson<Record<string, unknown>>(extractionText);

  // =========================================================================
  // STUFE 2: Notary Auditor & Reconciler Agent (Kosteneffizienter Delta-Modus)
  // =========================================================================
  onStep(2, 'Stufe 2: Notarielle Vorprüfung, Fristen & Plausibilisierung...');

  const auditorContextPrompt = `Heutiges Bearbeitungsdatum: ${todayStr}
VORGANGSTYP: ${caseType}

Hier ist das vorläufig extrahierte Roh-Dossier aus Stufe 1 (Ingestion & Extraction Agent):
\`\`\`json
${JSON.stringify(parsedExtractionRaw, null, 2)}
\`\`\`

AKTENKONTEXT & NACHRICHTEN:
${notesSection || 'Keine internen Notizen.'}

Führe nun als Notary Auditor & Reconciler Agent die Qualitätskontrolle durch:
1. Prüfe auf Widersprüche und spätere Vereinbarungen: Wurden nachweislich neuere oder abweichende Absprachen getroffen, trage den final gültigen Wert im Hauptdatenfeld ein und erfasse Vorwerte in Historien-/Vorwertfeldern.
2. Prüfe Fristen & Gültigkeiten anhand gesetzlicher Prüfungsmaßstäbe:
   - Bei Urkunden mit gesetzlicher Befristung (wie Energieausweise gem. § 80 Abs. 2 GEG für 10 Jahre) ist der Status 'OUTDATED' ('isExpired': true) zu setzen, wenn das Gültigkeitsdatum vor dem Bearbeitungsstichtag liegt.
   - Bestandsurkunden ohne kalendarisches Ablaufdatum (wie Grundbuchauszüge gem. § 21 BeurkG) verfallen nicht; sie belegen den Aktenstand ('VERIFIED'). Ein älteres Auszugsdatum wird neutral als Hinweis in 'note' vermerkt (vor Beurkundung amtlicher Online-Abruf gem. § 21 BeurkG).
   - 'OUTDATED' gilt ansonsten nur, wenn im Aktenbestand ein jüngeres Dokument desselben Typs vorliegt, das das ältere ablöst.
3. Prüfe formelle Vollständigkeit: Fehlen für Rechtsformen oder Personen erforderliche gesetzliche Nachweise (z.B. Registerauszug gem. § 12 HGB, § 21 BNotO), erstelle gezielte Nachforderungen ("inquiries").
4. Kontrolliere, dass jedes Feld eine nachvollziehbare Quelle ("source.fileName" und "source.snippet") besitzt.
5. STRENGSTE REGEL FÜR BELEGE: Ein Feld darf NIEMALS "VERIFIED" erhalten, wenn die tatsächlichen Datenwerte fehlen! Setze bei unvollständigen Daten zwingend "NEEDS_REVIEW" und formuliere eine konkrete Begründung in 'note'.
6. VERWENDE EXAKT DIE ENGLISCHEN SCHEMA-ATTRIBUTE (z.B. "amountInFigures", "blatt", "validUntil", "lenderName", "mortgageAmount", "parcels").
7. EXECUTIVE SUMMARY IN REINEM KANZLEIDEUTSCH: Formuliere die Gesamteinschätzung sachlich und prägnant auf Deutsch. Verwende NIEMALS englische Statuswörter wie "Status: ACTION_REQUIRED", "OUTDATED" oder "MISSING" im Fließtext!

EFFIZIENZ-REGEL:
Gib im "fields"-Objekt AUSSCHLIESSLICH diejenigen Felder aus, die du korrigierst oder anpasst! Unveränderte Felder aus Stufe 1 lässt du weg.

Antworte AUSSCHLIESSLICH im validen JSON-Format:
{
  "fields": { ... nur geänderte Felder ... },
  "inquiries": [ ... ],
  "overallStatus": "READY" | "ACTION_REQUIRED" | "BLOCKED",
  "executiveSummary": "1-2 prägnante deutsche Sätze zum Bearbeitungsstand (OHNE Status-Codes wie ACTION_REQUIRED)."
}`;

  let parsedAuditorModifications: Record<string, unknown> = {};
  let auditorOverallStatus: 'READY' | 'ACTION_REQUIRED' | 'BLOCKED' | undefined;
  let auditorExecutiveSummary: string | undefined;
  let auditorInquiries: unknown[] | undefined;

  try {
    const auditorResult = await generateText({
      model,
      instructions: auditorInstructions,
      messages: [
        {
          role: 'user',
          content: auditorContextPrompt,
        },
      ],
      temperature: 0.1,
    });

    const parsedAuditorRaw = cleanAndParseJson<Record<string, unknown>>(auditorResult.text);
    if (parsedAuditorRaw && typeof parsedAuditorRaw === 'object') {
      if (parsedAuditorRaw.fields && typeof parsedAuditorRaw.fields === 'object') {
        parsedAuditorModifications = parsedAuditorRaw.fields as Record<string, unknown>;
      }
      if (
        typeof parsedAuditorRaw.overallStatus === 'string' &&
        ['READY', 'ACTION_REQUIRED', 'BLOCKED'].includes(parsedAuditorRaw.overallStatus)
      ) {
        auditorOverallStatus = parsedAuditorRaw.overallStatus as
          'READY' | 'ACTION_REQUIRED' | 'BLOCKED';
      }
      if (typeof parsedAuditorRaw.executiveSummary === 'string') {
        auditorExecutiveSummary = parsedAuditorRaw.executiveSummary;
      }
      if (Array.isArray(parsedAuditorRaw.inquiries)) {
        auditorInquiries = parsedAuditorRaw.inquiries;
      }
    }
  } catch (auditorErr) {
    console.warn(
      'Auditor & Reconciler Agent Warnung (verwende Extraktions-Ergebnis als sicheren Fallback):',
      auditorErr
    );
  }

  // =========================================================================
  // STUFE 3: Quality-Gate, Schema Normalisierung & Persistierung
  // =========================================================================
  onStep(3, 'Stufe 3: Prüfbericht & Konsistenzabgleich läuft...');

  const currentAnalysisTimestamp = new Date().toISOString();
  const rawCaseTitle =
    typeof parsedExtractionRaw.caseTitle === 'string' ? parsedExtractionRaw.caseTitle : undefined;
  const rawExecutiveSummary =
    auditorExecutiveSummary ||
    (typeof parsedExtractionRaw.executiveSummary === 'string'
      ? parsedExtractionRaw.executiveSummary
      : undefined);
  const rawOverallStatus =
    auditorOverallStatus ||
    (typeof parsedExtractionRaw.overallStatus === 'string' &&
    ['READY', 'ACTION_REQUIRED', 'BLOCKED'].includes(parsedExtractionRaw.overallStatus)
      ? (parsedExtractionRaw.overallStatus as 'READY' | 'ACTION_REQUIRED' | 'BLOCKED')
      : 'ACTION_REQUIRED');

  let dossier: Dossier;
  const emptyFields = createEmptyImmobilienFields();

  const stage1Fields = (
    parsedExtractionRaw.fields && typeof parsedExtractionRaw.fields === 'object'
      ? parsedExtractionRaw.fields
      : {}
  ) as Record<string, Partial<GenericFieldDossier<Record<string, unknown>>>>;

  const baseFields: ImmobilienFields =
    existingDossier && existingDossier.fields
      ? { ...(existingDossier.fields as ImmobilienFields) }
      : { ...emptyFields };
  const mergedFields: ImmobilienFields = { ...baseFields };
  const mergedFieldsRecord = mergedFields as Record<string, GenericFieldDossier>;

  // Schritt 1: Stufe-1 Extraktionen einmergen
  for (const [key, rawField] of Object.entries(stage1Fields)) {
    if (rawField && mergedFieldsRecord[key]) {
      mergedFieldsRecord[key] = {
        data: {
          ...mergedFieldsRecord[key].data,
          ...(rawField.data || {}),
        },
        status: rawField.status || mergedFieldsRecord[key].status,
        source: {
          ...mergedFieldsRecord[key].source,
          ...(rawField.source || {}),
        },
        note: rawField.note ?? mergedFieldsRecord[key].note,
        actionRequired: rawField.actionRequired ?? mergedFieldsRecord[key].actionRequired,
      };
    }
  }

  // Schritt 2: Stufe-2 Reconciler Modifikationen (Delta) gezielt darüber mergen
  for (const [key, modField] of Object.entries(parsedAuditorModifications)) {
    const rawMod = modField as Partial<GenericFieldDossier<Record<string, unknown>>>;
    if (rawMod && mergedFieldsRecord[key]) {
      mergedFieldsRecord[key] = {
        data: {
          ...mergedFieldsRecord[key].data,
          ...(rawMod.data || {}),
        },
        status: rawMod.status || mergedFieldsRecord[key].status,
        source: {
          ...mergedFieldsRecord[key].source,
          ...(rawMod.source || {}),
        },
        note: rawMod.note ?? mergedFieldsRecord[key].note,
        actionRequired: rawMod.actionRequired ?? mergedFieldsRecord[key].actionRequired,
      };
    }
  }

  const rawInquiriesList =
    auditorInquiries ||
    (Array.isArray(parsedExtractionRaw.inquiries) ? parsedExtractionRaw.inquiries : []);

  const normalizedInquiries: Inquiry[] = (
    Array.isArray(rawInquiriesList) ? rawInquiriesList : []
  ).map((inq: unknown, idx: number): Inquiry => {
    const item = inq && typeof inq === 'object' ? (inq as Record<string, unknown>) : {};
    const priority =
      typeof item.priority === 'string' && ['CRITICAL', 'HIGH', 'MEDIUM'].includes(item.priority)
        ? (item.priority as 'CRITICAL' | 'HIGH' | 'MEDIUM')
        : 'HIGH';

    return {
      id: typeof item.id === 'string' && item.id ? item.id : `inq-${idx + 1}`,
      fieldKey: typeof item.fieldKey === 'string' && item.fieldKey ? item.fieldKey : 'all',
      recipient:
        typeof item.recipient === 'string' && item.recipient ? item.recipient : 'VERKAEUFER',
      priority,
      subject: typeof item.subject === 'string' && item.subject ? item.subject : 'Nachforderung',
      message:
        typeof item.message === 'string' && item.message
          ? item.message
          : typeof item.description === 'string'
            ? item.description
            : '',
      justification: typeof item.justification === 'string' ? item.justification : '',
      resolved: typeof item.resolved === 'boolean' ? item.resolved : false,
    };
  });

  const fallbackCaseTitle =
    rawCaseTitle || `Immobilienkauf ${new Date().toLocaleDateString('de-DE')}`;
  const rawImmobilienPayload = {
    caseType: caseType || 'IMMOBILIENKAUF',
    caseTitle: fallbackCaseTitle,
    analysisTimestamp: currentAnalysisTimestamp,
    detectedDocuments: Array.isArray(parsedExtractionRaw.detectedDocuments)
      ? parsedExtractionRaw.detectedDocuments
      : [],
    fields: mergedFields,
    inquiries: normalizedInquiries,
    overallStatus: rawOverallStatus,
    executiveSummary: rawExecutiveSummary || 'Analyse abgeschlossen.',
  };

  const parseResult = ImmobilienDossierSchema.safeParse(rawImmobilienPayload);
  if (!parseResult.success) {
    console.warn(
      'Immobilien Zod Validierungswarnung (nutze Fallback):',
      parseResult.error.format()
    );
    dossier = {
      caseType: 'IMMOBILIENKAUF',
      caseTitle: rawCaseTitle || `Immobilienkauf ${new Date().toLocaleDateString('de-DE')}`,
      analysisTimestamp: currentAnalysisTimestamp,
      detectedDocuments: Array.isArray(parsedExtractionRaw.detectedDocuments)
        ? parsedExtractionRaw.detectedDocuments
        : [],
      fields: mergedFields,
      inquiries: normalizedInquiries,
      overallStatus: rawOverallStatus,
      executiveSummary: rawExecutiveSummary || 'Analyse abgeschlossen.',
    };
  } else {
    dossier = {
      ...parseResult.data,
      caseType: 'IMMOBILIENKAUF',
    };
  }

  if (existingDossier && existingDossier.detectedDocuments) {
    const currentNames = new Set(dossier.detectedDocuments.map((d) => d.fileName.toLowerCase()));
    for (const prevDoc of existingDossier.detectedDocuments) {
      if (!currentNames.has(prevDoc.fileName.toLowerCase())) {
        dossier.detectedDocuments.unshift(prevDoc);
      }
    }
  }

  return normalizeDossier(dossier, noteList);
}
