# ADR 0003: Ganzakte im Modellkontext statt Retrieval über die Akte

**Status:** Angenommen (rückwirkend dokumentiert)

## Kontext

Eine Akte enthält Querverweise: Vollmachten in Anlagen, Klauseln, die auf andere Urkunden verweisen. Stückelt man die Akte in Chunks und holt nur Treffer, gehen diese Verbindungen verloren. Gleichzeitig überlesen Modelle bei sehr langen Kontexten Randvermerke ([enterprise-legal-processing.md](../architecture/enterprise-legal-processing.md), „Lost-in-the-Middle“).

## Entscheidung

Standardakten bis 80 Seiten bleiben ungeteilt im globalen Kontext (ROADMAP B.8.4). Nur sehr umfangreiche Sonstige-Bände (über 150 Seiten oder 300.000 Zeichen) werden in überlappende Fenster zerlegt ([document-windowing.ts](../../src/lib/files/document-windowing.ts)). Vektor- und Volltextsuche dient ausschließlich den Rechtsnormen in `knowledge_documents`, nicht der Akte selbst. Die Pipeline hat zwei Stufen: Extraktion mit deterministischer Belegprüfung, dann Auditor und Abgleich.

## Folgen

- Querverweise bleiben auffindbar; die Belegprüfung läuft gegen den vollständigen Quelltext.
- Die Kosten wachsen mit dem Aktenumfang; Kontingent und Verbrauchserfassung (`llm_usage`) begrenzen sie.
- Die Referenzarchitektur mit fünf Stufen und je Dokumenttyp spezialisierten Workern in [enterprise-legal-processing.md](../architecture/enterprise-legal-processing.md) ist nicht umgesetzt; im Code existieren zwei Stufen (`runExtractionStage`, Auditor). Das Dokument beschreibt eine Zielarchitektur und weicht in diesem Punkt vom Ist-Stand ab.

## Verworfene Alternativen

Retrieval über Akten-Chunks (wie bei einem Notizbuch-Assistenten) und je Dokumenttyp getrennte Extraktions-Worker. Der zweite Ansatz steht als Ziel im Referenzdokument, wurde aber zugunsten der erprobten 2-Stufen-Pipeline nicht gebaut (ROADMAP B.8.1).
