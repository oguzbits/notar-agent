# Asynchrone Job-Orchestrierung

> **Architektur-Spezifikation:** Asynchrone Hintergrundverarbeitung im 24/7-Kanzleibetrieb  
> **Kernkomponenten:** `src/types/jobs.ts`, `src/lib/jobs/job-repository.ts`, `src/lib/jobs/job-worker.ts`, PostgreSQL `dossier_jobs`

---

## 1. Problemstellung im Kanzleialltag

| Problem                | Auswirkung ohne Queue (Synchron)                                                                  | Lösung mit PostgreSQL-Queue (`dossier_jobs`)                                           |
| :--------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------- |
| **HTTP-Timeouts**      | Proxies kappen Verbindungen nach 30–60 s. 100-Seiten-Lauf bricht mit `504 Gateway Timeout` ab.    | HTTP-Upload antwortet in **< 250 ms** mit `202 Accepted` (`status: PENDING`).          |
| **Tab-Schließung**     | Sachbearbeiter schließt den Browser $\rightarrow$ Lauf bricht ab, Tokens verbrannt.               | Jobs persistieren transaktionssicher in Postgres; Bearbeitung läuft entkoppelt weiter. |
| **Peak-Load & Limits** | Wenn morgens 8 Mitarbeiter gleichzeitig Akten hochladen, drohen `429 Rate Limits` oder RAM-Crash. | **Concurrency Control:** Worker greift Jobs via `FOR UPDATE SKIP LOCKED`.              |
| **Transiente Fehler**  | KI-Server überlastet (`529 Overloaded`) $\rightarrow$ Vorgang scheitert.                          | Automatischer Retry-Zähler im Job-Record mit geregeltem Backoff.                       |

---

## 2. Job-Lifecycle & Sequenz

```mermaid
stateDiagram-v2
    [*] --> PENDING: Upload empfangen (< 250ms, 202 Accepted)
    PENDING --> PROCESSING: Worker greift Job via after() (Stufe 1 Extraction)
    PROCESSING --> PROCESSING: Stage-Update in DB (Stufe 2 RAG-Auditor)
    PROCESSING --> COMPLETED: Transaktionssicher im Dossier persistiert
    PROCESSING --> FAILED: LLM Timeout / Unleserlicher Scan
    FAILED --> PENDING: Manueller oder automatischer Retry
    COMPLETED --> [*]
```

```mermaid
sequenceDiagram
    autonumber
    actor Notar as Sachbearbeiter / Notar
    participant UI as Cockpit Frontend
    participant API as Next.js API (Ingestion /api/analyze)
    participant Worker as Background Task (Next.js after)
    participant DB as Postgres (dossier_jobs & dossiers)
    participant LLM as Vercel AI SDK (Claude / Gemini)

    Notar->>UI: Upload Dokumentensatz (z.B. 120 Seiten PDF)
    UI->>API: POST /api/analyze?async=true
    API->>DB: Job anlegen: status = 'PENDING', payload = { files, caseType }
    API->>Worker: Enqueue via after(() => executeDossierJob(job.id))
    API-->>UI: 202 Accepted { jobId, status: "PENDING", pollUrl }

    Note over UI,API: Sofortige Entlastung des Webservers (< 250ms)
    UI->>API: Status-Polling (/api/jobs/:id)

    rect rgb(240, 248, 255)
    Note over Worker,DB: Autarke Hintergrundausführung ohne externe Webhooks
    Worker->>DB: Status: { stage: "PAGE_SPLITTING", progress: 15% }
    Worker->>Worker: Hybrides OCR / Vision-Chunking
    Worker->>DB: Status: { stage: "EXTRACTION", progress: 45% }
    Worker->>LLM: Stufe 1: Extraction Agent
    LLM-->>Worker: Roh-Dossier
    Worker->>DB: Status: { stage: "AUDITING", progress: 80% }
    Worker->>LLM: Stufe 2: Notary Auditor & Reconciler
    LLM-->>Worker: Finales Delta
    end

    Worker->>DB: Status = 'COMPLETED', Dossier & Audit-Trail persistieren
    UI->>Notar: Cockpit-Tabelle fertig gerendert anzeigen
```

---

## 3. Serverlose Event-Orchestrierung & Autarke Ausführung

### Entkoppelte Ausführung via Next.js `after()`

Für Uploads und Analysen aus der Web-Applikation (`POST /api/analyze?async=true`) wird der Hintergrund-Worker direkt im Serverless-Lifecycle verankert:

- **Sofortige Antwort:** Der Client erhält binnen < 250 ms ein `202 Accepted` mit `jobId`.
- **Runtime-Garantie:** Über `after(() => executeDossierJob(job.id))` garantiert die Next.js-Laufzeit auf Vercel, dass die Lambda-Funktion bis zum Abschluss der Analyse aktiv bleibt, ohne auf externe HTTP-Aufrufe angewiesen zu sein.
- **Lokale Autarkie & Zero-Config:** Funktioniert lokal in `npm run dev` sowie in Produktion ohne Ngrok, externe Tunnel, Webhook-Pings oder zusätzliche `SUPABASE_WEBHOOK_SECRET`-Keys.
- **Lease Timeout & Orphan Sweeper:** Bricht ein Serverless-Container unerwartet ab, identifiziert die Abfrage verwaiste Jobs anhand von `lease_timeout_at` und ermöglicht automatische Retries.
