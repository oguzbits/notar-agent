# Architekturentscheidungen (ADR)

> **Zweck:** Festhalten, warum eine Entscheidung fiel. Das Wie steht in [ARCHITECTURE.md](../ARCHITECTURE.md) und den Spezifikationen unter [docs/architecture/](../architecture/); die Regeln in [AGENTS.md](../../AGENTS.md).

Je Entscheidung eine Datei mit Kontext, Entscheidung, Folgen und Alternativen. Die Einträge 0001 bis 0005 sind rückwirkend aus dem Bestand dokumentiert (Stand 21.11.2026); die Fakten stammen aus den verlinkten Quellen, die Abwägung unter „Kontext“ ist rückblickend formuliert. Wird eine Entscheidung ersetzt, bekommt der alte Eintrag den Status „Ersetzt durch“ und bleibt stehen.

| Nr.                                               | Entscheidung                                             | Status     |
| :------------------------------------------------ | :------------------------------------------------------- | :--------- |
| [0001](0001-hintergrundverarbeitung-mit-after.md) | Hintergrundverarbeitung mit `after()` statt Dauer-Worker | Angenommen |
| [0002](0002-konsolidierte-domaenenmigrationen.md) | Drei konsolidierte Domänenmigrationen                    | Angenommen |
| [0003](0003-ganzakte-im-kontext.md)               | Ganzakte im Modellkontext statt Retrieval über die Akte  | Angenommen |
| [0004](0004-fachregeln-als-daten.md)              | Fachregeln als Daten in `knowledge_documents`            | Angenommen |
| [0005](0005-hash-kette-in-der-datenbank.md)       | Audit-Hash-Kette per Datenbank-Trigger                   | Angenommen |
| [0006](0006-idempotenz-ueber-job-id.md)           | Idempotenz der Hintergrund-Analyse über die Job-ID       | Angenommen |
