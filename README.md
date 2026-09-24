# Notar Agent – Intelligente Urkunden-Zuarbeit (Agentischer Workflow)

Autonome LegalTech-Webapplikation zur Unterstützung von Notariaten bei der Aufbereitung, Prüfung, Strukturierung und Lückenanalyse unstrukturierter Unterlagen für **Immobilienkaufverträge**.

> 📖 **Architektur, Agentic Engineering & Deep-Dive:** Eine ausführliche Dokumentation des technischen Systems, der Schichtenarchitektur, der Safety-Hooks und der Quality Gates findest du in [`docs/overview.md`](docs/overview.md).

---

## 🚀 Schnellstart & Lokale Ausführung

### 1. Voraussetzungen

- **Node.js:** `>= 22.x` (empfohlen: Node 22 LTS)
- **Paketmanager:** `npm`
- **Docker:** Docker Desktop (für die lokale Supabase PostgreSQL 17 Datenbank)

### 2. Installation

```bash
git clone <repository-url>
cd notar-agent
npm install
```

### 3. Umgebungsvariablen (`.env.local`)

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
AI_MODEL="claude-haiku-4-5"

# Supabase (Werte für lokale Docker-Instanz bereits vorbereitet)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<lokaler-anon-key>"
```

### 4. Lokale Supabase-Entwicklung via Docker

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

### 5. Anwendung starten

```bash
npm run dev
```

Die App ist anschließend unter [http://localhost:3000](http://localhost:3000) im Browser erreichbar.

---

## 📂 Unterlagen testen & Lade-Anleitung

Aus Datenschutzgründen sind keine echten Mandantendokumente im Git-Repository versioniert. Zum Testen:

1. Öffne die Web-Applikation unter [http://localhost:3000](http://localhost:3000).
2. Klicke auf **„Neuen Vorgang starten“** (oder nutze bei leerem Datenbestand **„Erste Akte anlegen“**).
3. **Dateien hochladen (Drag-and-Drop):**
   - **PDFs:** Grundbuchauszüge, Kaufvertragsentwürfe, Energieausweise, Flurkarten, Mietaufstellungen.
   - **Bild-Scans (JPG, PNG):** Abfotografierte Urkunden, Personalausweise, handschriftliche Vermerke.
   - **Text- & E-Mail-Dateien:** Makler-Notizen, `.txt`, `.eml`.
4. **Ergänzende Hinweise (Optional):** Informelle Absprachen im Textfeld notieren (z. B. _„Kaufpreis wurde nachverhandelt auf 500.000 €“_).
5. Klicke auf **„Unterlagen prüfen“**: Der agentische Prüfprozess extrahiert die 10 Pflichtfelder, führt Fristenabgleiche durch und stellt das Ergebnis im Cockpit dar.

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
