# Notar Agent – Intelligente Urkunden-Zuarbeit (Agentischer Workflow)

Autonome LegalTech-Webapplikation zur Unterstützung von Notariaten bei der Aufbereitung, Prüfung, Strukturierung und Lückenanalyse unstrukturierter Unterlagen für **Immobilienkaufverträge**.

> 📖 **Architektur, Agentic Engineering & Deep-Dive:** Eine ausführliche Dokumentation des technischen Systems, der Schichtenarchitektur, der Safety-Hooks und der Quality Gates findest du in [`docs/overview.md`](docs/overview.md).

---

## 🚀 Schnellstart & Live-Demo

### 🌐 Option A: Live-Demo direkt im Browser testen (Empfohlen)

Die Anwendung ist produktiv bereitgestellt unter **[notar-agent.vercel.app](https://notar-agent.vercel.app)**:

1. **1-Klick Demo-Login:**
   - Öffne die Login-Seite und klicke auf den Button **„Demo-Kanzlei testen“**.
   - Du wirst sofort als Notar **Dr. Johannes von Berg** (`Notariat Dr. Johannes von Berg & Partner`) mit vollen Notar-Rechten angemeldet.
   - Es gibt keinen unauthentifizierten Gast-Modus oder verwirrende Notfall-Zustände mehr – die Authentifizierung erfolgt über eine vollwertige Supabase-Session.
2. **Sauberer Startzustand (Clean Slate):**
   - Das Dashboard startet bewusst mit einem leeren Vorgangspostfach (ohne verwirrende Altdaten oder feste Seed-Dateien).
3. **Sofort-Test mit vorbereiteten Testakten:**
   - Klicke auf **„Neuen Vorgang starten“** (oder **„Erste Akte anlegen“**).
   - Nimm eine der synthetischen, datenschutzkonformen Testakten aus dem Ordner [`test-akten/`](test-akten/) (z. B. [`test-akten/fall-04-standard-urkunde/Kaufvertrag_Koeln_UR89.pdf`](test-akten/fall-04-standard-urkunde/Kaufvertrag_Koeln_UR89.pdf) für den fehlerfreien Standardfall oder [`test-akten/fall-03-vertragsaenderung-handschrift/Kaufvertrag_Scan.png`](test-akten/fall-03-vertragsaenderung-handschrift/Kaufvertrag_Scan.png) für handschriftliche Randkorrekturen).
   - Ziehe die Datei per Drag-and-Drop in den Upload-Bereich und klicke auf **„Unterlagen prüfen“**.
   - Die KI analysiert die Urkunde, validiert die 10 Pflichtfelder mit Belegzitaten und schlüsselt das Ergebnis im Notar-Cockpit auf.

---

### 💻 Option B: Lokale Entwicklung & Ausführung

#### 1. Voraussetzungen

- **Node.js:** `>= 22.x` (empfohlen: Node 22 LTS)
- **Paketmanager:** `npm`
- **Docker:** Docker Desktop (für die lokale Supabase PostgreSQL 17 Datenbank)

#### 2. Installation

```bash
git clone <repository-url>
cd notar-agent
npm install
```

#### 3. Umgebungsvariablen (`.env.local`)

Erstelle eine `.env.local`-Datei im Projektstamm:

```bash
cp .env.example .env.local
```

Wichtigste Konfiguration:

```env
# Erforderlich: Mindestens ein LLM-Provider API-Key
ANTHROPIC_API_KEY="sk-ant-..."
# oder GOOGLE_GENERATIVE_AI_API_KEY="..."

# Modell-Wahl (Standard: schnelles & kosteneffizientes Parsing)
AI_MODEL="claude-haiku-5-5"

# Supabase (Werte für lokale Docker-Instanz bereits vorbereitet)
NEXT_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_SUPABASE_PUBLISHABLE_KEY="<lokaler-anon-key>"
```

#### 4. Lokale Supabase-Entwicklung via Docker

Das Projekt nutzt Supabase PostgreSQL als Single Source of Truth (SSOT):

```bash
# Startet PostgreSQL, Auth, Storage & Supabase Studio
npm run db:start
```

- **Supabase Studio (Web UI):** [http://localhost:54323](http://localhost:54323) zur Inspektion von Tabellen, RLS und Daten.
- **Nützliche DB-Befehle:**
  - `npm run db:reset`: Setzt die lokale Datenbank zurück und wendet alle Migrationen in `supabase/migrations/` frisch an.
  - `npm run db:status`: Zeigt Ports, Keys und Status der Container an.
  - `npm run db:lint`: Validiert das DB-Schema auf Security- und RLS-Richtlinien.
  - `npm run db:stop`: Stoppt die lokalen Container.

#### 5. Anwendung starten

```bash
npm run dev
```

Die App ist anschließend unter [http://localhost:3000](http://localhost:3000) im Browser erreichbar.

---

## 📂 Unterlagen testen & Real-World Testakten

Im Verzeichnis [`test-akten/`](test-akten/) stehen **10 synthetische, datenschutzkonforme Referenzakten** (§ 203 StGB / DSGVO) bereit. Sie bilden reale Bedingungen des notariellen Alltags nach (Multimodalität, Handschriften, Scan-Artefakte, Fristprüfungen nach GEG und Vollständigkeitskontrollen nach § 21 BeurkG).

### Empfohlene Testabläufe für die Evaluierung:

1. **Happy Path (Empfohlener Einstieg):**
   - **Datei:** [`test-akten/fall-04-standard-urkunde/Kaufvertrag_Koeln_UR89.pdf`](test-akten/fall-04-standard-urkunde/Kaufvertrag_Koeln_UR89.pdf)
   - **Prüfziel:** Vollständige Urkunde ohne Mängel.
   - **Ergebnis:** Gesamtstatus `READY`, alle 10 Pflichtfelder `VERIFIED`, 0 Beanstandungen.

2. **Handschriften- & Randkorrektur-Erkennung:**
   - **Datei:** [`test-akten/fall-03-vertragsaenderung-handschrift/Kaufvertrag_Scan.png`](test-akten/fall-03-vertragsaenderung-handschrift/Kaufvertrag_Scan.png)
   - **Prüfziel:** Priorisiert die KI die handschriftliche Randkorrektur über dem Drucktext?
   - **Ergebnis:** Kaufpreis `425.000,00 EUR` (nicht 450.000 €!), Status `NEEDS_REVIEW` mit Prüfhinweis zur handschriftlichen Korrektur.

3. **Gesetzliche Fristenfalle (§ 80 GEG – Energieausweis):**
   - **Datei:** [`test-akten/fall-06-energieausweis-prueffrist/Energieausweis_AachenerStr.pdf`](test-akten/fall-06-energieausweis-prueffrist/Energieausweis_AachenerStr.pdf)
   - **Prüfziel:** Erkennt das Modell die 10-Jahres-Gültigkeit eigenständig?
   - **Ergebnis:** Status `NEEDS_REVIEW`, Warnung: _„Energieausweis abgelaufen (Gültig bis 10.02.2023)“_.

4. **Vollständigkeitsprüfung & Grundbuchrecht (§ 21 BeurkG):**
   - **Datei:** [`test-akten/fall-02-grundbuch-vollstaendigkeit/Grundbuchauszug_Lindenthal.png`](test-akten/fall-02-grundbuch-vollstaendigkeit/Grundbuchauszug_Lindenthal.png)
   - **Prüfziel:** Erkennt die KI, dass Seite 2 (Abt. I Eigentümer) fehlt?
   - **Ergebnis:** Status `NEEDS_REVIEW`, Beurkundungssperre wegen fehlender Eigentümerdaten.

5. **MFH-Mieterliste & Arithmetik:**
   - **Datei:** [`test-akten/fall-08-mieterliste-handschrift/Mieterliste_Objekt_Lindenthal.pdf`](test-akten/fall-08-mieterliste-handschrift/Mieterliste_Objekt_Lindenthal.pdf)
   - **Prüfziel:** Erkennt das System 28 gedruckte + 2 handschriftliche Parteien und errechnet die korrekte Gesamtmiete?
   - **Ergebnis:** 30 Parteien erkannt, Monatsmiete Netto: `19.125,00 EUR`, Jahresmiete: `229.500,00 EUR`.

### So führst du den Test in der App durch:

1. Öffne die Web-Applikation unter [http://localhost:3000](http://localhost:3000) (oder [notar-agent.vercel.app](https://notar-agent.vercel.app)) und melde dich mit einem Klick auf **„Demo-Kanzlei testen“** an.
2. Klicke auf **„Neuen Vorgang starten“** (oder **„Erste Akte anlegen“**).
3. Ziehe die gewünschte Datei (z. B. `Kaufvertrag_Koeln_UR89.pdf`) per Drag-and-Drop in den Upload-Bereich.
4. _(Optional)_ Informelle Notizen im Textfeld vermerken (z. B. _„Käufer reicht Ausweis nach“_).
5. Klicke auf **„Unterlagen prüfen“**: Der agentische Prüfprozess extrahiert die 10 Pflichtfelder mit Belegzitaten, prüft juristische Regeln und stellt das Ergebnis im Cockpit dar.

---

## 🧪 Funktionsumfang & Sachbearbeiter-Cockpit

1. **Dashboard & Vorgangsübersicht:**
   - Übersicht aller bisherigen Vorgänge mit einheitlichen Aktenzeichen (`Immobilienkauf - <ID>`), Reifegrad-Status (`In Prüfung` vs. `Entwurfsreif`), Suchleiste und Löschfunktion.

2. **Inkrementelles Nachreichen (Delta-Modus):**
   - Nachträgliches Einpflegen fehlender Nachweise oder E-Mails über **„Unterlagen nachreichen“**, ohne bereits verifizierte Daten zu verlieren.

3. **Multimodale KI-Analyse & 10 Pflichtfelder (Ampelsystem):**
   - Automatische Dokumentenerkennung und Klassifikation (`HIGH`, `MEDIUM`, `LOW`, `OBSOLETE`, `UNRELATED`).
   - Die 10 Kernfelder: Verkäufer, Käufer, Grundbuch, Grundstücke, Kaufpreis, Finanzierung, Belastungen, Mietverhältnisse, Energieausweis, Übergabe.
   - Reifegrade: `Belegt` (`VERIFIED`), `Prüfung nötig` (`NEEDS_REVIEW`), `Veraltet` (`OUTDATED`), `Fehlt` (`MISSING`).
   - **Lückenloser Audit-Trail (§ 17 BeurkG):** Jede Zahl und Angabe ist mit Dateiquelle, Seitennummer und Original-Textzitat (`snippet`) belegt.
   - **Konnexitätsprüfung & Diskrepanzerkennung:** Isolierung abweichender Liegenschaftsdaten und Nachverfolgung der Kaufpreis-Historie.

4. **Human-in-the-Loop, Nachforderungen & Kanzlei-Export:**
   - Sachbearbeiter-Übersteuerung mit Dokumentationsgrund.
   - Proaktive, vorformulierte Nachforderungsschreiben an Makler, Parteien oder Grundbuchamt mit 1-Klick-Kopierfunktion.
   - 1-Klick-Übertrag des formatierten Prüfberichts in Kanzleisoftware (z. B. TriNotar, NoRA) sowie vollständiger JSON-Export des Dossiers.

---

## 🏗 Technischer Kern-Stack & Architektur-Highlights

- **Frontend & UI:** Next.js 16 (App Router mit Turbopack), React 19, Tailwind CSS, Radix UI Primitives, Lucide Icons, TanStack Query.
- **Agentic Engine & Ingestion:** Vercel AI SDK (`ai`), `@ai-sdk/anthropic` & `@ai-sdk/google`. Dual-Stream Ingestion (Byte-Level PDF Classifier für blitzschnelle Unicode-Textextraktion vs. gezielte Vision-Tokens bei Scans/Siegeln) mit SSE-Streaming (`/api/analyze`).
- **Asynchrone Großakten-Queue:** Transaktionssichere PostgreSQL-Job-Queue (`dossier_jobs` via `SKIP LOCKED`) zur entkoppelten Verarbeitung von 50–200 Seiten ohne Timeout-Gefahr (< 250 ms `202 Accepted`).
- **Persistenz & Kanzlei-Compliance:** Supabase PostgreSQL 17 mit strikter Row-Level Security (RLS) nach § 203 StGB, dynamischer Wissensbasis via `pgvector` und lückenlosem, kryptographischem Audit-Trail (SHA-256 Hash-Chaining nach § 17 BeurkG).
- **Automatisierte Evaluation & Testakten:** Promptfoo Golden Dataset Evaluationen (`npm run eval:smoke`, `npm run eval:live`) gegen synthetische, datenschutzkonforme Kanzlei-Stresstests in `test-akten/`.
- **Deterministische Quality Gates:** 290+ Vitest-Tests, Playwright E2E, Dependency Cruiser (`depcruise`), Knip, jscpd (Duplication Audit), Magic-String-Checks und Husky Pre-Commit/Pre-Push Hooks.
