# ADR 0006: Idempotenz der Hintergrund-Analyse über die Job-ID

**Status:** Angenommen (21.11.2026)

## Kontext

Eine Analyse verursacht Modellkosten. Ein Doppelklick, ein Netzwerk-Retry oder ein erneutes Absenden nach einem Timeout konnte bisher zwei Jobs und damit zwei Läufe auslösen; beide zählten ins Stundenkontingent. Eine eigene Spalte für den Schlüssel hätte eine Migration verlangt, die bis zur Live-Einspielung die Veröffentlichung blockiert ([ADR 0002](0002-konsolidierte-domaenenmigrationen.md)).

## Entscheidung

Der Client sendet einen `Idempotency-Key` (UUID) und behält ihn für denselben Inhalt, bis der Server den Job bestätigt hat; nach der Bestätigung oder bei geändertem Inhalt erzeugt er einen neuen. Der Schlüssel ist zugleich die Job-ID, `dossier_jobs.id` ist ohnehin `TEXT PRIMARY KEY`. Die Route schlägt den Schlüssel in der eigenen Kanzlei nach, bevor sie das Kontingent prüft; gibt es den Job, antwortet sie mit `202` und startet keinen Worker. Bei gleichzeitigen Anfragen entscheidet die Primärschlüssel-Verletzung (SQLSTATE `23505`): genau eine Anfrage legt an. Gehört die ID einer anderen Kanzlei (nicht lesbar), antwortet die Route mit `409`.

Gilt nur für den Hintergrund-Pfad (`?async=true`). Der Live-Stream hat keinen Job und damit keinen Schlüssel.

## Folgen

- Eine Wiederholung verbraucht kein Kontingent und kostet nichts.
- Der Schlüssel wird nicht gegen den Inhalt der Anfrage geprüft: dieselbe ID mit anderem Inhalt liefert den ersten Job. Das ist unkritisch, solange der Client den Schlüssel nur für identischen Inhalt wiederverwendet (so arbeitet `useAnalysisWorkflow`).
- Ein fehlgeschlagener Job wird bei Wiederholung mit demselben Schlüssel unverändert zurückgegeben; Neustart läuft über `POST /api/jobs`.
- Der Fremd-Konflikt verrät höchstens, dass eine UUID vergeben ist; sie ist nicht ratbar.

## Verworfene Alternativen

Eine Spalte `idempotency_key` mit eindeutigem Index (sauberer, aber Migration), ein Vergleich des Inhalts per Hash (mehr Aufwand ohne belegten Bedarf).
