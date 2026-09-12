import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { generateText, type SystemModelMessage } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '@/lib/ai/prompts';
import { normalizeDossier } from '@/lib/dossier-helpers';
import { persistDossierRecord } from '@/lib/supabase/server';
import {
  CaseType,
  Dossier,
  DetectedDocument,
  ImmobilienDossierSchema,
  GenericFieldDossier,
  ImmobilienFields,
  Inquiry,
} from '@/types/dossier';

export const maxDuration = 60; // Erlaube bis zu 60s Laufzeit für Dokumentenanalysen

interface UploadedFilePayload {
  name: string;
  type: string;
  size: number;
  content?: string; // Textinhalt oder Base64 Daten
  isBase64?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: UploadedFilePayload[] = body.files || [];
    const caseType: CaseType = body.caseType || 'IMMOBILIENKAUF';
    const notes: string = body.notes || '';
    const documentId: string | undefined = body.documentId;
    const existingDossier: Dossier | undefined = body.existingDossier;

    if (!files || files.length === 0) {
      // Wenn ein bestehendes Dossier aktualisiert wird, genügt auch eine reine Notiz/Sachverhaltshinweis
      if (!existingDossier || !notes.trim()) {
        return NextResponse.json(
          { error: 'Keine Dokumente oder Notizen für die Aktualisierung übermittelt.' },
          { status: 400 }
        );
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!geminiKey && !anthropicKey) {
      return NextResponse.json(
        {
          error:
            'Kein KI-API-Key konfiguriert. Bitte hinterlege GEMINI_API_KEY oder ANTHROPIC_API_KEY in deiner .env.local.',
        },
        { status: 500 }
      );
    }

    const useGemini = Boolean(geminiKey && (!anthropicKey || process.env.AI_PROVIDER === 'google'));

    let model;
    let extractionInstructions: SystemModelMessage;
    let auditorInstructions: SystemModelMessage;

    if (useGemini) {
      const google = createGoogle({
        apiKey: geminiKey,
      });
      const modelName =
        process.env.AI_MODEL && !process.env.AI_MODEL.startsWith('claude')
          ? process.env.AI_MODEL
          : 'gemini-3.5-flash-lite';
      model = google(modelName);
      extractionInstructions = {
        role: 'system',
        content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
      };
      auditorInstructions = {
        role: 'system',
        content: NOTARY_AUDITOR_RECONCILER_PROMPT,
      };
    } else {
      const anthropicHeaders: Record<string, string> = {};
      if (process.env.ANTHROPIC_WORKSPACE_ID) {
        anthropicHeaders['anthropic-workspace-id'] = process.env.ANTHROPIC_WORKSPACE_ID;
      }

      const anthropic = createAnthropic({
        apiKey: anthropicKey,
        headers: anthropicHeaders,
      });
      const modelName = process.env.AI_MODEL || 'claude-haiku-4-5';
      model = anthropic(modelName);
      extractionInstructions = {
        role: 'system',
        content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      };
      auditorInstructions = {
        role: 'system',
        content: NOTARY_AUDITOR_RECONCILER_PROMPT,
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
        },
      };
    }

    // Konstruiere multimodale bzw. textuelle User-Nachricht mit aktuellem Datumsbezug
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

    // Bereite Notizen strukturiert vor (jede Notiz erhält ein prägnantes Notiz #X Label)
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

    // Füge Inhalte der einzelnen Dateien hinzu
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
        // Native PDF-Übergabe an Claude (Dokumenten-Engine) statt Base64-Text-Müll
        // Entferne evtl. Data-URL Prefix "data:application/pdf;base64,"
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

    // Server-Sent Events (SSE) Stream für reaktives Echtzeit-Tracking im Frontend
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // =========================================================================
          // STUFE 1: Ingestion & Extraction Agent
          // =========================================================================
          sendEvent({
            type: 'step',
            step: 1,
            stepDetail: 'Stufe 1: Urkunden- & Sachverhaltserfassung läuft...',
          });

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

          let cleanExtractionJson = extractionText.trim();
          if (cleanExtractionJson.startsWith('```')) {
            cleanExtractionJson = cleanExtractionJson
              .replace(/^```(?:json)?\n?/, '')
              .replace(/\n?```$/, '')
              .trim();
          }

          let parsedExtractionRaw: Record<string, unknown>;
          try {
            const parsed = JSON.parse(cleanExtractionJson);
            parsedExtractionRaw =
              parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
          } catch (parseErr) {
            console.error('JSON Parse Fehler bei Extraktions-Agent:', cleanExtractionJson);
            throw new Error(
              `Extraktions-Agent hat kein gültiges JSON geliefert: ${parseErr instanceof Error ? parseErr.message : 'Syntaxfehler'}`
            );
          }

          // =========================================================================
          // STUFE 2: Notary Auditor & Reconciler Agent (Kosteneffizienter Delta-Modus)
          // =========================================================================
          sendEvent({
            type: 'step',
            step: 2,
            stepDetail: 'Stufe 2: Notarielle Vorprüfung, Fristen & Plausibilisierung...',
          });

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

            let cleanAuditorJson = auditorResult.text.trim();
            if (cleanAuditorJson.startsWith('```')) {
              cleanAuditorJson = cleanAuditorJson
                .replace(/^```(?:json)?\n?/, '')
                .replace(/\n?```$/, '')
                .trim();
            }

            const parsedAuditorRaw = JSON.parse(cleanAuditorJson);
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
          sendEvent({
            type: 'step',
            step: 3,
            stepDetail: 'Stufe 3: Prüfbericht & Konsistenzabgleich läuft...',
          });

          const currentAnalysisTimestamp = new Date().toISOString();
          const rawCaseTitle =
            typeof parsedExtractionRaw.caseTitle === 'string'
              ? parsedExtractionRaw.caseTitle
              : undefined;
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
          const emptyFields = (
            await import('@/lib/dossier-defaults')
          ).createEmptyImmobilienFields();

          // Basis-Felder aus Stufe 1 oder bisherigem Dossier
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
          const mergedFieldsRecord = mergedFields as unknown as Record<string, GenericFieldDossier>;

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

          // Inquiries aus Stufe 2 priorisieren, sonst aus Stufe 1
          const rawInquiriesList =
            auditorInquiries ||
            (Array.isArray(parsedExtractionRaw.inquiries) ? parsedExtractionRaw.inquiries : []);

          const normalizedInquiries = (Array.isArray(rawInquiriesList) ? rawInquiriesList : []).map(
            (inq: unknown, idx: number) => {
              const item = inq && typeof inq === 'object' ? (inq as Record<string, unknown>) : {};
              const priority =
                typeof item.priority === 'string' &&
                ['CRITICAL', 'HIGH', 'MEDIUM'].includes(item.priority)
                  ? (item.priority as 'CRITICAL' | 'HIGH' | 'MEDIUM')
                  : 'HIGH';

              return {
                id: typeof item.id === 'string' && item.id ? item.id : `inq-${idx + 1}`,
                fieldKey:
                  typeof item.fieldKey === 'string' && item.fieldKey ? item.fieldKey : 'all',
                recipient:
                  typeof item.recipient === 'string' && item.recipient
                    ? item.recipient
                    : 'VERKAEUFER',
                priority,
                subject:
                  typeof item.subject === 'string' && item.subject ? item.subject : 'Nachforderung',
                message:
                  typeof item.message === 'string' && item.message
                    ? item.message
                    : typeof item.description === 'string'
                      ? item.description
                      : '',
                justification: typeof item.justification === 'string' ? item.justification : '',
                resolved: typeof item.resolved === 'boolean' ? item.resolved : false,
              };
            }
          );

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
              inquiries: normalizedInquiries as unknown as Inquiry[],
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
            const currentNames = new Set(
              dossier.detectedDocuments.map((d) => d.fileName.toLowerCase())
            );
            for (const prevDoc of existingDossier.detectedDocuments) {
              if (!currentNames.has(prevDoc.fileName.toLowerCase())) {
                dossier.detectedDocuments.unshift(prevDoc);
              }
            }
          }

          dossier = normalizeDossier(dossier, noteList);

          let persistenceResult;
          if (documentId) {
            const { updateDossierRecord, getServerSupabase, getUniformCaseTitle } =
              await import('@/lib/supabase/server');
            const updateRes = await updateDossierRecord(documentId, dossier);
            const isSupabase = !!getServerSupabase();
            const uniformTitle = getUniformCaseTitle(dossier.caseType, documentId);
            persistenceResult = {
              persisted: updateRes.success,
              storageType: isSupabase ? ('supabase' as const) : ('in-memory' as const),
              caseNumber: uniformTitle,
              id: documentId,
            };
          } else {
            persistenceResult = await persistDossierRecord(dossier);
          }

          sendEvent({
            type: 'result',
            success: true,
            dossier,
            persistence: persistenceResult,
            workflow: {
              type: 'MULTI_AGENT',
              stages: [
                'STAGE_1_INGESTION_EXTRACTION_AGENT',
                'STAGE_2_NOTARY_AUDITOR_RECONCILER_AGENT (DELTA_MODE)',
              ],
            },
          });

          controller.close();
        } catch (error: unknown) {
          console.error('Analyse-Fehler im Stream:', error);
          const message =
            error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
          sendEvent({
            type: 'error',
            error: `Analyse fehlgeschlagen: ${message}`,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Analyse-Fehler:', error);
    const message =
      error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, dossier } = body;

    if (!documentId || !dossier) {
      return NextResponse.json(
        { error: 'documentId und dossier sind erforderlich.' },
        { status: 400 }
      );
    }

    const { updateDossierRecord, getServerSupabase } = await import('@/lib/supabase/server');
    const updateRes = await updateDossierRecord(documentId, dossier);

    if (!updateRes.success) {
      return NextResponse.json(
        { error: updateRes.error || 'Update fehlgeschlagen' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storageType: getServerSupabase() ? 'supabase' : 'in-memory',
    });
  } catch (error: unknown) {
    console.error('PUT Analyse Error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
