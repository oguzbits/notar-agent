# ADR 0001: Hintergrundverarbeitung mit `after()` statt Dauer-Worker

**Status:** Angenommen (rückwirkend dokumentiert)

## Kontext

Großakten mit 50 bis 200 Seiten brauchen länger als ein HTTP-Request. Die Anwendung läuft serverlos auf Vercel mit 60 Sekunden Laufzeit je Funktion ([job-orchestration.md](../architecture/job-orchestration.md)). Ein eigener Server oder Worker-Prozess wäre zusätzliche Infrastruktur und Betriebslast.

## Entscheidung

`POST /api/analyze?async=true` legt einen Job in `dossier_jobs` an, antwortet mit `202` und führt `executeDossierJob` über `after()` im selben Serverless-Lebenszyklus aus. Die Pipeline ist in zwei Stufen geteilt; das Zwischenergebnis (`stage1Output`) liegt als Checkpoint im Job, damit jede Stufe ein eigenes 60-Sekunden-Budget hat. Statuswechsel laufen als Compare-and-set (`transitionJob`).

## Folgen

- Kein Dauerbetrieb, keine Tunnel oder Webhook-Schlüssel; lokal wie in Produktion derselbe Weg.
- Bricht eine Instanz ab, erneuert niemand `updated_at`. Der Cron `/api/cron/deletion` und die Jobliste setzen Jobs nach drei Minuten ohne Lebenszeichen auf `FAILED`. Offene Randfälle stehen in [ROADMAP.md](../ROADMAP.md) (B.11.7).
- Wiederholte Anfragen erzeugen ohne weitere Maßnahmen zusätzliche Jobs; siehe [ADR 0006](0006-idempotenz-ueber-job-id.md).

## Verworfene Alternativen

Ein Dauer-Worker mit atomarem Abholen (`SKIP LOCKED`) ist im Backlog vorgemerkt. Er wird neu bewertet, sobald die Lasttests (ROADMAP B.9) belastbare Zahlen liefern.
