import { test, expect } from '@playwright/test';
import { SYNTHETIC_KAUFVERTRAG_RAW, SYNTHETIC_BEARBEITER_NOTIZ } from './fixtures/test-files';
import { IMMOBILIEN_FIELD_METADATA } from '../src/lib/dossier/constants';
import { CASE_STATUS } from '../src/lib/supabase/repository';
import {
  CASE_TYPES,
  FIELD_STATUS,
  OVERALL_STATUS,
  DOCUMENT_RELIABILITY,
  NOTAR_DOCUMENT_TYPES,
  INQUIRY_PRIORITY,
  INQUIRY_RECIPIENT,
  STORAGE_TYPES,
} from '../src/types/dossier';
import { JOB_STATUS, JOB_STAGES } from '../src/types/jobs';

test.describe('Notar Agent E2E Smoke Workflow (A.1)', () => {
  test('durchläuft vollständigen Sachbearbeiter-Workflow: Upload -> Stepper -> Cockpit -> Status-Override -> Export', async ({
    page,
  }) => {
    // 1. Mock für SSE-Analyse-Endpunkt /api/analyze aufsetzen
    const mockDossierId = 'doc-e2e-smoke-123';
    const mockCaseTitle = 'Kaufvertrag Friedrichshain (Blatt 4512)';

    const mockDossier = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      caseTitle: mockCaseTitle,
      analysisTimestamp: new Date().toISOString(),
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      executiveSummary:
        'Erstanalyse abgeschlossen. 9 von 10 Pflichtfeldern belegt. Energieausweis liegt noch nicht vor.',
      detectedDocuments: [
        {
          fileName: 'kaufvertrag_entwurf.txt',
          documentType: NOTAR_DOCUMENT_TYPES.KAUFVERTRAGSENTWURF,
          date: '2026-09-13',
          pageCount: 1,
          reliability: DOCUMENT_RELIABILITY.HIGH,
        },
        {
          fileName: 'Notiz #1',
          documentType: NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ,
          date: '2026-09-13',
          pageCount: 1,
          reliability: DOCUMENT_RELIABILITY.LOW,
          summary: SYNTHETIC_BEARBEITER_NOTIZ,
        },
      ],
      inquiries: [
        {
          id: 'inq-ea-1',
          fieldKey: 'energieausweis',
          recipient: INQUIRY_RECIPIENT.VERKAEUFER,
          priority: INQUIRY_PRIORITY.HIGH,
          subject: 'Energieausweis fehlt gem. § 80 GEG',
          message: 'Bitte Energieausweis oder Nachweis über Denkmalstatus vorlegen.',
          justification: 'Gesetzliche Pflichtangabe.',
          resolved: false,
        },
      ],
      userNotes: [SYNTHETIC_BEARBEITER_NOTIZ],
      fields: {
        verkaeufer: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            name: 'Maximilian Kaufmann',
            legalForm: 'Natürliche Person',
            address: 'Musterstraße 12, 10115 Berlin',
          },
          source: {
            fileName: 'kaufvertrag_entwurf.txt',
            pageNumber: 1,
            snippet: 'Maximilian Kaufmann',
          },
          note: 'Identität und Eigentümerstellung plausibilisiert.',
        },
        kaeufer: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            name: 'Sabine Investor',
            legalForm: 'Natürliche Person',
            address: 'Allee 45, 80331 München',
          },
          source: {
            fileName: 'kaufvertrag_entwurf.txt',
            pageNumber: 1,
            snippet: 'Sabine Investor',
          },
          note: 'Käuferin vollständig erfasst.',
        },
        grundbuch: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            amtsgericht: 'Berlin-Mitte',
            grundbuchBezirk: 'Friedrichshain',
            blatt: '4512',
            isCurrent: true,
          },
          source: { fileName: 'kaufvertrag_entwurf.txt', pageNumber: 1, snippet: 'Blatt 4512' },
          note: 'Grundbuchangaben erfasst.',
        },
        grundstuecke: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            totalAreaM2: 650,
            parcels: [
              {
                flur: '12',
                flurstueckNummer: '104/2',
                wirtschaftsart: 'Gebäude- und Freifläche',
                sizeM2: 650,
              },
            ],
          },
          source: {
            fileName: 'kaufvertrag_entwurf.txt',
            pageNumber: 1,
            snippet: 'Flurstück 104/2',
          },
          note: 'Flurstück und Fläche eindeutig.',
        },
        kaufpreis: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            amountInFigures: 450000,
            amountInWords: 'vierhundertfünfzigtausend Euro',
            currency: 'EUR',
            isFinalAgreedPrice: true,
          },
          source: { fileName: 'kaufvertrag_entwurf.txt', pageNumber: 1, snippet: '450.000,00 €' },
          note: 'Kaufpreis beziffert und übereinstimmend.',
        },
        finanzierung: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            mortgageAmount: 0,
            requiresFinancingPowerOfAttorney: false,
            lenderName: 'Keine Fremdfinanzierung / Eigenmittel',
          },
          source: { fileName: 'kaufvertrag_entwurf.txt', pageNumber: 1, snippet: 'Kaufpreis' },
          note: 'Keine gesonderte Belastungsvollmacht erbeten (Eigenmittel).',
        },
        belastungen: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            entries: ['Lastenfrei in Abteilung II und III'],
            clearingRequirements: [],
          },
          source: { fileName: 'kaufvertrag_entwurf.txt', pageNumber: 1, snippet: 'Grundbuchstand' },
          note: 'Lastenfreier Erwerb vorgesehen.',
        },
        mietverhaeltnisse: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            fullRentedStatus: false,
            statedInEmailOrOverview: 'Keine Mietverhältnisse / Eigennutzung',
          },
          source: { fileName: 'kaufvertrag_entwurf.txt', pageNumber: 1, snippet: 'Kaufpreis' },
          note: 'Eigennutzung / keine bestehenden Mietverhältnisse.',
        },
        energieausweis: {
          status: FIELD_STATUS.NEEDS_REVIEW,
          data: {
            efficiencyClass: 'B',
            energyValueKWh: 75,
            validUntil: '2032-05-01',
            isExpired: false,
          },
          note: 'Energieausweis nach § 80 GEG noch nicht vorgelegt.',
          actionRequired: 'Energieausweis vom Verkäufer anfordern oder Denkmalschutz prüfen.',
        },
        uebergabe: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            targetDate: '2026-11-15',
            conditionDescription: 'nach vollständiger Kaufpreiszahlung',
          },
          source: { fileName: 'Notiz #1', pageNumber: 1, snippet: '15.11.2026' },
          note: 'Übergabedatum aus Notiz #1 übernommen.',
        },
      },
    };

    let currentDossierState = structuredClone(mockDossier);

    const mockJobId = 'job-e2e-smoke-456';

    // Mock API Route für POST /api/analyze* (sowohl SSE als auch Async) und PUT
    await page.route('*/**/api/analyze*', async (route) => {
      const method = route.request().method();
      const url = new URL(route.request().url());
      const isAsync = url.searchParams.get('async') === 'true';

      if (method === 'POST') {
        currentDossierState = structuredClone(mockDossier);
        if (isAsync) {
          await route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Job erfolgreich eingereiht.',
              jobId: mockJobId,
              status: JOB_STATUS.PROCESSING,
              pollUrl: `/api/jobs/${mockJobId}`,
            }),
          });
          return;
        }

        const sseBody = [
          `data: ${JSON.stringify({ type: 'step', step: 1, stepDetail: 'Dateien werden erfasst...' })}\n\n`,
          `data: ${JSON.stringify({ type: 'step', step: 2, stepDetail: 'Notarielle Vorprüfung aktiv...' })}\n\n`,
          `data: ${JSON.stringify({ type: 'step', step: 3, stepDetail: 'Prüfbericht wird generiert...' })}\n\n`,
          `data: ${JSON.stringify({
            type: 'result',
            success: true,
            dossier: currentDossierState,
            persistence: {
              id: mockDossierId,
              storageType: STORAGE_TYPES.SUPABASE,
              caseNumber: 'KV-2026-4512',
            },
          })}\n\n`,
        ].join('');

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream; charset=utf-8',
          headers: {
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
          body: sseBody,
        });
      } else if (method === 'PUT') {
        const body = route.request().postDataJSON();
        if (body?.dossier) {
          currentDossierState = body.dossier;
        }
        // Status-Override Speicherung
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, storageType: STORAGE_TYPES.SUPABASE }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock API Route für GET /api/jobs* (liefert den fertigen Testjob)
    await page.route('*/**/api/jobs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [
            {
              id: mockJobId,
              status: JOB_STATUS.COMPLETED,
              stage: JOB_STAGES.PERSISTING,
              resultDossierId: mockDossierId,
              payload: {
                caseType: CASE_TYPES.IMMOBILIENKAUF,
                notes: SYNTHETIC_BEARBEITER_NOTIZ,
                files: [{ name: 'kaufvertrag_entwurf.txt', size: 1024 }],
              },
            },
          ],
        }),
      });
    });

    // Mock API Route für GET /api/documents* (Dokumentenliste)
    await page.route('*/**/api/documents*', async (route) => {
      const url = new URL(route.request().url());
      const docId = url.searchParams.get('id');
      if (docId === mockDossierId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            document: {
              id: mockDossierId,
              title: mockCaseTitle,
              status: CASE_STATUS.IN_PROGRESS,
              content: currentDossierState,
              created_at: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            documents: [
              {
                id: mockDossierId,
                title: mockCaseTitle,
                status: CASE_STATUS.IN_PROGRESS,
                content: currentDossierState,
                created_at: new Date().toISOString(),
              },
            ],
          }),
        });
      }
    });

    // 2. Start auf der Vorgangsübersicht
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Vorgangsübersicht');

    // 3. Klick auf "Neue Zuarbeit starten"
    const newVorgangButton = page.getByRole('button', { name: /Neue Zuarbeit starten/i });
    await expect(newVorgangButton).toBeVisible();
    await newVorgangButton.click();

    // 4. Upload-Ansicht prüfen
    await expect(page.locator('h1')).toContainText('Neuer Urkundenvorgang');
    await expect(page).toHaveURL(/\/\?view=upload/);

    // 5. Datei per File-Input hochladen
    const filePayload = {
      name: 'kaufvertrag_entwurf.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(SYNTHETIC_KAUFVERTRAG_RAW, 'utf-8'),
    };
    await page.setInputFiles('input[type="file"]', filePayload);

    // Überprüfen, dass die Datei in der Liste aufgeführt ist und der Submit-Button aktiv wird
    await expect(page.getByText('kaufvertrag_entwurf.txt')).toBeVisible();

    // Notiz erfassen
    const noteTextarea = page.locator('textarea').first();
    await noteTextarea.fill(SYNTHETIC_BEARBEITER_NOTIZ);

    // 6. Analyse starten
    const submitButton = page.getByRole('button', { name: /Unterlagen prüfen/i });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // 7. Weiterleitung & Cockpit-Ansicht prüfen
    await page.waitForURL(new RegExp(`vorgang=${mockDossierId}`));
    await expect(page.getByRole('heading', { name: mockCaseTitle })).toBeVisible();

    // 8. Prüfbericht & 10 Pflichtfelder in der UnifiedFieldCockpitTable verifizieren
    await expect(page.getByText(/Prüfbericht & Notarielle Pflichtangaben/i)).toBeVisible();
    await expect(page.getByText(/9\/10 Pflichtfelder belegt/i)).toBeVisible();

    // Prüfe Präsenz der zentralen Pflichtfelder
    await expect(page.locator('tr').filter({ hasText: 'Verkäufer' }).first()).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: 'Käufer' }).first()).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: 'Grundbuch' }).first()).toBeVisible();
    await expect(page.locator('tr').filter({ hasText: 'Kaufpreis' }).first()).toBeVisible();
    const energieTitle =
      IMMOBILIEN_FIELD_METADATA.energieausweis?.title ?? NOTAR_DOCUMENT_TYPES.ENERGIEAUSWEIS;
    await expect(page.locator('tr').filter({ hasText: energieTitle }).first()).toBeVisible();

    // 9. Human-in-the-Loop Status-Override: Energieausweis manuell auf "Belegt" setzen
    const rowEnergy = page.locator('tr').filter({ hasText: energieTitle }).first();
    const selectDropdown = rowEnergy.locator('select');
    await expect(selectDropdown).toBeVisible();
    await expect(selectDropdown).toHaveValue(FIELD_STATUS.NEEDS_REVIEW);

    // Sachbearbeiter überschreibt Status auf VERIFIED
    await selectDropdown.selectOption(FIELD_STATUS.VERIFIED);

    // Revisionssicherer Pflichtbegründungs-Dialog (§ 17 ff. BeurkG) erscheint
    const modalDialog = page.getByRole('dialog');
    await expect(modalDialog).toBeVisible();
    await page
      .getByLabel(/Begründung für die Akte/i)
      .fill('Originaler Energieausweis lag bei Beurkundung vor.');
    await page.getByRole('button', { name: /Freigabe im Audit-Trail quittieren/i }).click();

    // UI-Reaktion & Bestätigung abwarten
    await expect(selectDropdown).toHaveValue(FIELD_STATUS.VERIFIED);

    // 10. Revisionssicheren Export prüfen
    const downloadPromise = page.waitForEvent('download');
    const exportButton = page.getByRole('button', { name: /JSON-Export/i });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('kaufvertrag');
  });
});
