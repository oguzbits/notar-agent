# Asynchrone Job-Orchestrierung & Webhooks

> **Architektur-Spezifikation:** Asynchrone Hintergrundverarbeitung im 24/7-Kanzleibetrieb  
> **Kernkomponenten:** `src/types/jobs.ts`, `src/lib/jobs/job-repository.ts`, `src/app/api/jobs/process-webhook/route.ts`, PostgreSQL `dossier_jobs`

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
    PENDING --> PROCESSING: Webhook/Worker greift Job (Stufe 1 Extraction)
    PROCESSING --> PROCESSING: Stage-Update via SSE (Stufe 2 RAG-Auditor)
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
    participant API as Next.js API (Ingestion)
    participant DB as Postgres (dossier_jobs & dossiers)
    participant Worker as Webhook Route Handler (/api/jobs/process-webhook)
    participant LLM as Vercel AI SDK (Claude / Gemini)

    Notar->>UI: Upload Dokumentensatz (z.B. 120 Seiten PDF)
    UI->>API: POST /api/dossiers/upload
    API->>DB: Job anlegen: status = 'PENDING', payload = { files, caseType }
    API-->>UI: 202 Accepted { jobId, status: "PENDING" }

    Note over UI,API: Sofortige Entlastung des Webservers (< 250ms)
    UI->>API: SSE-Stream (/api/dossiers/jobs/:id/status)

    rect rgb(240, 248, 255)
    Note over DB,Worker: Serverlose Webhook-Aktivierung
    DB->>Worker: Trigger trigger_dossier_job_pending -> POST mit x-webhook-secret
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

Das System unterstützt zwei komplementäre Ausführungsmodelle für asynchrone Jobs:

### A. Interner Standard: Entkoppelte Ausführung via Next.js `after()`

Für Uploads und Analysen aus der eigenen Web-Applikation (`POST /api/analyze?async=true`) wird der Hintergrund-Worker direkt im Serverless-Lifecycle verankert:

- **Sofortige Antwort:** Der Client erhält binnen < 250 ms ein `202 Accepted` mit `jobId`.
- **Runtime-Garantie:** Über `after(() => executeDossierJob(job.id))` garantiert die Next.js-Laufzeit auf Vercel, dass die Lambda-Funktion bis zum Abschluss der Analyse aktiv bleibt, ohne auf externe HTTP-Aufrufe angewiesen zu sein.
- **Lokale Autarkie:** Funktioniert lokal in `npm run dev` ohne Ngrok oder externe Tunnel.

### B. Externer Adapter: Supabase Database Webhooks

Für externe Systeme oder asynchrone Datenbank-Trigger bleibt der Webhook-Pfad als Adapter verfügbar:

- **Realtime Trigger:** Bei Anlage eines Jobs feuert der Trigger `trigger_dossier_job_pending` via Supabase an `/api/jobs/process-webhook`.
- **Kryptografische Sicherheit:** Header `x-webhook-secret` gleicht mit `SUPABASE_WEBHOOK_SECRET` ab.
- **Orphan Sweeper:** Falls ein Container abbricht, reaktiviert ein Lease-Timeout-Sweeper verwaiste Jobs automatisch.
