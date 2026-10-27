# Hybrid-Suche (Volltext + Vektor) für den Demo-Betrieb Implementation Plan

> **Für Ausführende:** Pflicht-Skill `superpowers:executing-plans` (inline). Tests und Code schreibt der Ausführende selbst (TDD); dieser Plan enthält nur Verträge, Regeln, Testfälle und die Zuordnung Schutz zu rotem Test.

**Ziel:** Die Pipeline kann optional die Anfrage einbetten und über die vorhandene RPC `match_knowledge_documents` hybrid suchen; Dokumentvektoren entstehen über ein Befüllskript. Ohne Konfiguration bleibt das Verhalten unverändert (nur Volltext).

**Herkunft:** Messbefund in [BACKLOG.md §19](../../../BACKLOG.md): Abdeckung Volltext 0,89, Hybrid 0,96; ohne Kennung 0,85 gegen 1,00. Vorab festgelegte Schwelle K1 (+0,08) knapp verfehlt (+0,07), K3 für Fälle ohne Kennung erfüllt. Entscheidung des Nutzers (27.10.2026): Free Tier, Demo, Datenschutz derzeit bewusst nachrangig. Deshalb Einführung als abschaltbarer Demo-Pfad, nicht als bewiesener Standard.

## Pre-Flight (AGENTS.md 4A)

- **Scope:** Einbettungs-Schnittstelle, Anfrage-Einbettung in der Pipeline, Schreibpfad und Befüllskript für Dokumentvektoren, Konfiguration, Doku.
- **Referenzbasis:** Supabase "Hybrid search" (RRF, pgvector, vorhandene RPC), Vercel AI SDK `embed`/`embedMany` (Provider-Abstraktion), Google Gemini Embeddings (Matryoshka, 1536 Dimensionen).
- **Architektur:** Verträge in `src/types/`, reine Formatierung und Schnittstelle in `src/lib/knowledge/`, Provider-Anbindung getrennt davon, Skript unter `scripts/knowledge/`. Keine Fachregeln im Code.
- **Nicht enthalten:** Live-Befüllung der Vektoren in der Produktiv-DB (Kosten, Schlüssel, Live-Änderung: nur auf ausdrückliche Zustimmung), HNSW-Index (35 Dokumente, nicht nötig), Vektoren für Dokumente der Dossiers, Umschalten des Standards auf Hybrid, Wiederholungsmessung mit zweitem Lauf.
- **Impact:** `LOCAL_CODE_ONLY`. Migration: `NOT_REQUIRED` (Spalte `embedding vector(1536)` und RPC bestehen).
- **Erfolg:** `npm run check`, `npm test`, `npm run test:db`.

## Geprüfte Fakten (Doku-Abruf 27.10.2026, Invariante 10)

- `gemini-embedding-2`: stabil, kein Abschaltdatum, Eingabe bis 8.192 Tokens, Dimension 128 bis 3072, 1536 unterstützt und wird automatisch normalisiert.
- Modell 2 kennt keinen `taskType`; stattdessen Präfix im Text: Anfrage `task: search result | query: {text}`, Dokument `title: {titel} | text: {inhalt}`.
- Vektorräume von Modell 001 und 2 sind unvereinbar; ein Modellwechsel verlangt vollständige Neu-Einbettung.
- Free Tier: Eingaben dürfen von Google zur Produktverbesserung genutzt werden. Für echte Mandantendaten ist bezahlter Zugang nötig.
- `@ai-sdk/google` v4 bietet `embeddingModel(id)`; Option `outputDimensionality` ist in den Typen vorhanden, `taskType` ebenfalls (für Modell 2 nicht setzen).

## Entscheidungsregeln

- Nachfragen nur bei: Live-DB-Änderung, Schlüssel/Secrets, Kosten, Schutzdateien. Alles andere selbst entscheiden.
- Kein Schlüssel wird gelesen oder gedruckt; der Nutzer führt das Befüllskript selbst aus.
- Commit je grüner Aufgabe auf `main`, normaler Push ist Routine. Nie `--no-verify`.
- Konfiguration: `EMBEDDING_MODEL_ID` in `src/env.ts` optional, ohne Wert nur Volltext (ausdrücklicher Schalter, kein Ausweichzustand). Ist der Wert gesetzt, wirft jeder Fehler der Einbettung (Fail-Fast), kein stilles Zurückfallen.

## Reihenfolge und Modelle

| #   | Aufgabe                                              | Modell | Review              |
| --- | ---------------------------------------------------- | ------ | ------------------- |
| 1   | Verträge, Konfiguration, Formatierung (rein)         | mittel | Gesamtprüfung       |
| 2   | Einbettungs-Schnittstelle und Gemini-Anbindung       | mittel | Gesamtprüfung       |
| 3   | Pipeline: Anfrage einbetten, an `search` übergeben   | mittel | eigenes (Fail-Fast) |
| 4   | Repository-Schreibpfad und Befüllskript              | mittel | Gesamtprüfung       |
| 5   | Doku-Parität (overview, ROADMAP, BACKLOG, CHANGELOG) | mittel | Gesamtprüfung       |

## Aufgabe 1: Verträge, Konfiguration, Formatierung

**Schnittstellen**

- `src/types/knowledge.ts`: `EMBEDDING_DIMENSIONS = 1536` (`as const`), Schema für einen Vektor: Zahlenfeld genau dieser Länge (`EmbeddingVectorSchema`).
- `src/env.ts`: `EMBEDDING_MODEL_ID: optionalTrimmedString` (kein Standardwert); `.env.example` mit Kommentar zum Free-Tier-Hinweis.
- `src/lib/knowledge/embedding-text.ts`: `formatQueryForEmbedding(text: string): string`, `formatDocumentForEmbedding(doc: { title: string; content: string }): string`.

**Regeln**

- Präfixe exakt wie in der Doku (siehe oben); Anfrage und Dokument werden getrimmt, leerer Text wirft.
- Vektor mit falscher Länge oder nicht endlichen Zahlen wird vom Schema abgelehnt.

**Testfälle**

1. Anfrage und Dokument erhalten das richtige Präfix.
2. Leere oder nur aus Leerraum bestehende Texte werfen.
3. Schema lehnt Länge 1535 und 1537, `NaN`, `Infinity` ab; nimmt 1536 an.
4. `env`: ohne Wert ist `EMBEDDING_MODEL_ID` `undefined`; mit Wert getrimmt.

**Schutz gegen roten Test:** Präfix entfernen macht Test 1 rot; Längenprüfung entfernen macht Test 3 rot.

## Aufgabe 2: Einbettungs-Schnittstelle und Gemini-Anbindung

**Schnittstelle** (`src/lib/knowledge/embedder.ts`):

- `interface IEmbedder { embedQuery(text: string): Promise<number[]>; embedDocuments(docs: { title: string; content: string }[]): Promise<number[][]> }`
- `createEmbedder(model: EmbeddingModel): IEmbedder` und `createGeminiEmbedder(modelId, apiKey)` in derselben Datei, nutzt `embed`/`embedMany` aus `ai` und `@ai-sdk/google`, `outputDimensionality: EMBEDDING_DIMENSIONS`, kein `taskType`; die Stapelung übernimmt `embedMany` nach der Modellgrenze.

**Regeln**

- Jede Antwort wird gegen `EmbeddingVectorSchema` geprüft; Anzahl der Vektoren muss der Eingabe entsprechen, sonst Fehler.
- Formatierung (Aufgabe 1) geschieht innerhalb der Anbindung, nicht beim Aufrufer.

**Testfälle** (Modell des SDK durch `MockEmbeddingModel` aus `ai/test` ersetzt, falls vorhanden, sonst durch injizierte Funktion)

1. `embedQuery` ruft das Modell mit dem Anfrage-Präfix und der Dimension 1536 auf.
2. `embedDocuments` behält die Reihenfolge, auch wenn das Modell die Eingabe auf mehrere Aufrufe verteilt (Grenze 2, fünf Dokumente, drei Aufrufe).
3. Vektor falscher Länge aus dem Modell wirft.
4. Fehler des Modells wird weitergereicht (kein Ausweichwert).

**Schutz gegen roten Test:** Dokument-Präfix entfernen oder Ergebnisse umordnen: Test 2; Schemaprüfung entfernen: Test 3; `try/catch` mit Ausweichwert: Test 4.

## Aufgabe 3: Pipeline

**Schnittstelle:** Die Pipeline erhält ein optionales `embedder?: IEmbedder` über ihre bestehende Abhängigkeitsübergabe; Aufrufstelle in `src/app/api/analyze/` erzeugt ihn nur, wenn `env.EMBEDDING_MODEL_ID` und `env.GEMINI_API_KEY` gesetzt sind.

**Regeln**

- Mit Einbettung: `knowledgeRepo.search({ queryText, queryEmbedding, organizationId, topK: 3 })`; ohne: unverändert.
- `queryText` und Einbettung stammen aus demselben `searchTerms`.
- Fehler der Einbettung bricht die Analyse ab (Fail-Fast), die Fehlermeldung nennt keine Technikbegriffe aus der Nutzeroberfläche (Invariante 6).
- `EMBEDDING_MODEL_ID` gesetzt, aber `GEMINI_API_KEY` fehlt: Konfigurationsfehler beim Erzeugen, nicht stilles Abschalten.

**Testfälle**

1. Ohne `embedder`: `search` wird ohne `queryEmbedding` aufgerufen (Verhalten unverändert).
2. Mit `embedder`: `search` erhält genau den von `embedQuery(searchTerms)` gelieferten Vektor.
3. `embedQuery` wirft: Pipeline wirft, `search` wird nicht aufgerufen.
4. Konfiguration mit Modell-ID ohne Schlüssel wirft.

**Schutz gegen roten Test:** Übergabe des Vektors entfernen: Test 2; Fehler schlucken: Test 3; Schlüsselprüfung entfernen: Test 4.

## Aufgabe 4: Schreibpfad und Befüllskript

**Schnittstellen**

- Nur `SupabaseKnowledgeRepository` (nicht `IKnowledgeRepository`, der Schreibpfad ist ein Verwaltungsvorgang): `listForEmbedding({ all }): Promise<{ id; title; content }[]>`, `saveEmbedding(id: string, vector: number[]): Promise<void>`.
- `scripts/knowledge/embed-documents.ts`: liest Dokumente ohne Vektor, bettet sie über `IEmbedder` ein, schreibt über `saveEmbedding`. Läuft gegen die durch Umgebungsvariablen benannte Datenbank mit Service-Rolle; Schlüssel und URL werden nur aus der Umgebung gelesen, nie ausgegeben. Meldet Anzahl und bricht beim ersten Fehler ab. Mit `--dry-run` nur zählen; `--all` bettet auch Dokumente mit vorhandenem Vektor neu ein.

**Regeln**

- Vektor wird gegen `EmbeddingVectorSchema` geprüft, bevor er geschrieben wird.
- Unbekannte ID oder Datenbankfehler wirft; kein Teilerfolg wird verschwiegen.

**Testfälle** (Repository gegen die lokale Supabase im DB-Test)

1. `listForEmbedding({ all: false })` liefert nur Dokumente mit `embedding IS NULL`, mit `all: true` alle.
2. `saveEmbedding` setzt den Vektor; danach fehlt das Dokument in der Liste.
3. Falsche Länge wirft vor dem Schreiben.
4. Unbekannte ID wirft.

**Schutz gegen roten Test:** Längenprüfung entfernen: Test 3; Prüfung auf betroffene Zeilen entfernen: Test 4.

## Aufgabe 5: Doku-Parität

- `docs/overview.md`: Abschnitt Wissensabruf um den optionalen Vektorpfad, den Schalter `EMBEDDING_MODEL_ID`, Fail-Fast und den Free-Tier-Hinweis (Eingaben können vom Anbieter genutzt werden; für echte Mandantendaten bezahlter Zugang nötig) ergänzen.
- `ROADMAP.md`: B.8.12 auf Stand bringen; Folgeaufgabe "Live-Befüllung der Vektoren (Zustimmung nötig)" und "zweiter Messlauf mit anonymisierten Notizen" als offene Punkte.
- `BACKLOG.md` §19: Einführungsstatus nachtragen.
- `CHANGELOG.md`: Eintrag nach Abschluss.

## Definition of Done

DoD-Quittung nach AGENTS.md 4C; `Database Migration & Sync: NOT_REQUIRED`; offen unter "Explicitly Out-of-Scope": Live-Befüllung (benötigt Schlüssel, Kosten, Zustimmung).

## Ledger

Aufgaben 1 bis 5 inline in der Hauptsitzung ausgeführt (keine Subagenten für die Umsetzung); eine Recherche (Haiku, 24.665 Tokens, 47 s) zur Embedding-Doku. Ergebnis: 5 Commits, `npm run check` und `npm test` (728 Tests) grün, DB-Test gegen lokale Supabase grün. Abweichungen vom Plan: keine eigene Stapelkonstante (`embedMany` stapelt), Schreibmethoden nur am Supabase-Repository statt am Interface, `getEmbedder()` wird in `runAuditorStage` aufgelöst (wie das Repository), damit auch der Job-Worker erfasst ist.
