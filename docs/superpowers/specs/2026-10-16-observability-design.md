# Observability (Zyklus 1) – Design

Zyklus 2 (Kostenerfassung, Token-Verbrauch) folgt separat und baut auf den hier gelegten Logs auf.

## Ziel

Fehler und Laufzeiten im Produktivbetrieb sichtbar machen, ohne dass Inhalte des Notariatsfalls (§ 203 StGB) einen Dienst verlassen.

## Entscheidungen

1. **Sentry EU (`@sentry/nextjs`)** für Fehler. Mitgeschickt werden nur Fehlerklasse, Stacktrace, Route, `job_id` und `organization_id`.
   - Die Initialisierung erfolgt nur bei gesetztem DSN (`SENTRY_DSN` in `src/env.ts`, optional). Ohne DSN wird `Sentry.init` nicht aufgerufen.
   - `dataCollection` schaltet Cookies, Header, Request-/Response-Bodies, Query-Parameter, Benutzerdaten, `genAI`-Ein- und Ausgaben, Stack-Variablen und Datenbankabfragen ab.
   - `beforeSend` und `beforeBreadcrumb` rufen die reine Funktion `scrubEvent` auf, die alles außer der Allowlist (Fehlertyp, Stacktrace ohne Variablen, Route, `job_id`, `organization_id`) entfernt.
   - Dateien: `instrumentation.ts`, `instrumentation-client.ts`, `withSentryConfig` in `next.config`, `global-error.tsx`.
2. **Strukturierter Logger** `src/lib/observability/logger.ts`.
   - Er schreibt eine JSON-Zeile pro Ereignis: `level`, `event`, `stage`, `durationMs`, `model`, `jobId`, `outcome`.
   - Der Typ erlaubt nur diese Felder. Freitext und Fehlerobjekte sind nicht zugelassen, bei Fehlern wird nur der Klassenname geloggt.
   - Er ersetzt die `console.*`-Aufrufe in `pipeline.ts`, `analyze/route.ts`, `jobs/route.ts` und `server-auth.ts`.
   - Zeitmessung pro Stage direkt um die `generateText`-Aufrufe in `pipeline.ts`.
3. **Kein AI-SDK-Telemetrie-Export.** Das AI SDK 7 braucht `@ai-sdk/otel` und `registerTelemetry`, und eine Kombination mit der Sentry-Integration erzeugt doppelte Spans. Tokens gehören zu Zyklus 2 und werden dort aus `result.usage` gelesen. Damit entfällt eine Abhängigkeit.
4. **`GET /api/health`** ohne Authentifizierung.
   - Die Route macht einen DB-Ping und prüft die Konfiguration.
   - Die Antwort ist nur `{ status: "ok" | "fehler" }` mit HTTP 200 oder 503. Es gibt weder Details noch Fehlertexte.
   - Sie nutzt den Service-Role-Client nur für `select 1`.

## Schichten

- `src/types/observability.ts`: Zod-Schema `LogEventSchema` (`as const`-Enums für `level` und `outcome`).
- `src/lib/observability/`: `logger.ts` und `scrub-event.ts` (rein, ohne Sentry-Import).
- `src/app/api/health/route.ts`: dünner Adapter.
- Die Sentry-Initialisierung liegt in den Next-Einstiegsdateien und ruft nur `scrubEvent` auf.

## Tests (Liste)

- `scrubEvent` entfernt Request-Body, Cookies, Header, Benutzerdaten, Query und Extra-Daten. Der Test wird rot, wenn `beforeSend` den Scrubber nicht aufruft oder er die Allowlist verlässt.
- `scrubEvent` behält Fehlertyp, Route, `job_id` und `organization_id`.
- Der Logger verwirft unbekannte Felder (Schema), und sein Test wird rot, wenn Freitext durchgelassen wird.
- Die Pipeline loggt pro Stage genau ein Ereignis mit Dauer, auch im Fehlerfall (`outcome: "fehler"`).
- Health liefert 200 bei erreichbarer DB und 503 bei Fehler, jeweils ohne Details im Body.
- Ohne DSN wird `Sentry.init` nicht aufgerufen.

## Vor der Umsetzung zu prüfen (§2.10)

- `npm view @sentry/nextjs version peerDependencies`. Der Subagent nennt 11.8.0 mit Peer `next ^16`, bestätigt nur über einen Zusammenfasser.
- Ob `dataCollection` in der installierten Version die Felder wie beschrieben kennt.

## Nicht enthalten

Token und Kosten, OTel-Export, Dashboards, Session-Replay, Uptime-Dienst (nur der Endpunkt).

## Offen außerhalb des Codes

- Sentry-Konto mit EU-Region und DSN (Eintrag in `.env`, nicht im Repo).
- AVV mit Sentry.
- Der Logstream der Hosting-Plattform ist nicht geprüft.

## Doku

`docs/overview.md`, ROADMAP, CHANGELOG und BACKLOG §3 werden im selben Änderungssatz angepasst.
