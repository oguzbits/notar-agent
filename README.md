# NotarPartner Urkunden-Zuarbeit (Agentischer Workflow)

Intelligente Web-Applikation zur Unterstützung von Notariaten bei der autonomen Aufbereitung, Prüfung, Strukturierung und Lückenanalyse von unstrukturierten Unterlagen für **Immobilienkaufverträge**.

---

## 🎥 Screenwalkthrough (Video-Walkthrough)

Der vollständige Screenwalkthrough (gemäß Aufgabenstellung) liegt als modulare Video-Reihe im Verzeichnis [`Screenwalkthrough/`](Screenwalkthrough/):

1. **[`1.Einstieg_Neuer-Vorgang_Workflow-Stepper.mov`](Screenwalkthrough/1.Einstieg_Neuer-Vorgang_Workflow-Stepper.mov):** Einstieg, Heterogenität der Quellen, Erfassungsmaske & animierter 2-Stufen-Workflow (Extraction + Auditor via SSE).
2. **[`2.Cockpit_A-B-Vergleich.mov`](Screenwalkthrough/2.Cockpit_A-B-Vergleich.mov):** Das Cockpit im A-B-Vergleich (Vorgang ohne E-Mail vs. Vorgang mit E-Mail), Zod-Schematreue, Korrektur der Jahresnettomiete (142.020 € vs. 152.640 €) & lückenloser Belegpfad.
3. **[`3.Reifegrad_Nachreichen_Kontrollhoheit.mov`](Screenwalkthrough/3.Reifegrad_Nachreichen_Kontrollhoheit.mov):** Reifegrad-Wegweiser, iteratives Unterlagen-Nachreichen (Delta-Modus) & manuelle Kontroll- und Freigabehoheit in der Kanzlei.
4. **[`4.Tech-Stack_Export_Fazit.mov`](Screenwalkthrough/4.Tech-Stack_Export_Fazit.mov):** Next.js App Router, TypeScript, Vercel AI SDK, Zod, Supabase & 1-Klick-Übertrag in die Kanzleivorlage.

---

## 🚀 Schnellstart & Lokale Ausführung

### 1. Voraussetzungen

- Node.js >= 18.x (empfohlen: Node 20+)
- npm oder pnpm

### 2. Installation

```bash
git clone <dein-repo-link>
cd notar-partner-prototyp
npm install
```

### 3. Umgebungsvariablen (`.env.local`)

Erstelle eine `.env.local`-Datei im Projektstamm (siehe auch [`.env.example`](.env.example)):

```env
# Erforderlich: Anthropic API-Key
ANTHROPIC_API_KEY=

# Optional: Modell-Wahl (Standard: claude-haiku-4-5 für schnelles & kosteneffizientes Parsing)
AI_MODEL="claude-haiku-4-5"

# Optional: Supabase Persistenz (Tabelle 'documents')
# Empfehlung für lokales Testen: Einfach leer lassen!
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

> [!TIP]
> **Empfehlung für schnelles Testen (Ohne Datenbank-Setup):**
> Für lokale Tests und Demos wird **kein Supabase-Konto benötigt**! Wenn die Supabase-Variablen leer bleiben, schaltet die App automatisch in den **In-Memory-Modus**.
>
> - **Wo liegen die Daten?** Dossiers und Akten werden direkt im flüchtigen Arbeitsspeicher (RAM) des laufenden Node-Servers gehalten.
> - **Wann sind sie weg?** Die Daten bleiben beim normalen Browsen und Neuladen der Seite erhalten. Sie werden erst zurückgesetzt, wenn der Terminal-Prozess (`npm run dev`) gestoppt bzw. beendet wird.
> - **Vorteil:** Du kannst sofort loslegen – du brauchst lediglich deinen `ANTHROPIC_API_KEY`.

### 3.1 Lokale Supabase-Entwicklung via Docker (Empfohlen)

Das Projekt unterstützt eine vollständig isolierte, lokale Supabase-Instanz (PostgreSQL 17, Storage, Auth, Studio) via Docker:

1. **Docker Desktop starten.**
2. **Lokale Supabase starten:**
   ```bash
   npm run db:start
   ```
   _Startet alle Container und wendet automatisch alle Migrationen in `supabase/migrations/` an._
3. **Supabase Studio (Web UI):** Im Browser unter [http://localhost:54323](http://localhost:54323) aufrufen, um Tabellen, Daten und RLS-Policies visuell zu inspizieren.
4. **Nützliche Befehle:**
   - `npm run db:reset`: Setzt die lokale Datenbank vollständig zurück und führt alle Migrationen frisch aus.
   - `npm run db:lint`: Prüft das Datenbankschema auf Security- und RLS-Fehler.
   - `npm run db:stop`: Stoppt die lokalen Container.

### 3.2 Supabase Cloud einrichten (Optional für persistente Staging/Prod-Umgebung)

Falls Vorgänge alternativ in einem externen Supabase-Cloud-Projekt gespeichert werden sollen:

1. **Supabase-Projekt anlegen:** Erstelle ein kostenloses Projekt unter [supabase.com](https://supabase.com).
2. **Tabelle anlegen:** Öffne im Supabase-Dashboard den **SQL Editor** und führe folgendes Schema aus:

```sql
-- Tabelle für Beurkundungsvorgänge / Dossiers
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'In Prüfung',
  content jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Row Level Security (RLS) aktivieren
alter table documents enable row level security;

-- Lese- und Schreibzugriff für den Client erlauben (Demo/Prototyp)
create policy "Allow all access to documents"
on documents for all
using (true)
with check (true);

-- Tabelle für revisionssicheren Audit-Trail (§ 17 ff. BeurkG)
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  document_id text not null,
  sequence_number bigint not null,
  action text not null,
  timestamp timestamptz not null,
  actor text not null,
  previous_hash varchar(64) not null,
  current_hash varchar(64) not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_audit_logs_doc_seq unique (document_id, sequence_number)
);

alter table audit_logs enable row level security;

create policy "Allow all access to audit_logs"
on audit_logs for all
using (true)
with check (true);
```

3. **API-Schlüssel kopieren:** Gehe im Dashboard zu **Project Settings > API** und trage URL sowie den `anon` (Publishable) Key in deine `.env.local` ein:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<dein-projekt>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<dein-anon-key>
   ```

### 4. Anwendung starten

```bash
npm run dev
```

Die App ist anschließend im Browser unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## 📂 Lade-Anleitung für Unterlagen (Dokumente testen)

Aus Datenschutzgründen sind keine Original- oder Mandantendokumente im Git-Repository eingecheckt. Um die Analyse zu testen:

1. Öffne die Web-Applikation unter [http://localhost:3000](http://localhost:3000).
2. Klicke auf **„Neue Zuarbeit starten“** (oder nutze bei leerem Datenbestand **„Erste Akte anlegen“**).
3. **Dateien hochladen:** Ziehe beliebige zu prüfende Dateien in das Uploadfeld:
   - **PDF-Dokumente:** z. B. Grundbuchauszüge, Kaufvertragsentwürfe, Energieausweise, Flurkarten, Mietübersichten.
   - **Bild-Scans (JPG, PNG):** z. B. abfotografierte Urkunden, Personalausweise, handschriftliche Vermerke.
   - **Text- & E-Mail-Dateien:** z. B. Makler-Notizen, `.txt`, `.eml`.
4. **Ergänzende Hinweise (Optional):** Trage in das Notizfeld informelle Absprachen ein (z. B. _„Kaufpreis wurde nachverhandelt auf 500.000 €“_).
5. Klicke auf **„Unterlagen prüfen“**: Der agentische Prüfprozess (mit visueller Live-Statusanzeige im Stepper) extrahiert alle 10 Pflichtfelder, gleicht Fristen und Diskrepanzen ab und stellt das Ergebnis im Cockpit dar.

---

## 🧪 Funktionsumfang & Cockpit

1. **Dashboard & Vorgangsübersicht:**
   - Übersicht aller bisherigen Beurkundungsvorgänge mit einheitlichen Aktenzeichen (`Immobilienkauf - <ID>`), Reifegrad-Status (`In Prüfung` vs. `Entwurfsreif`), Suchleiste und Löschfunktion.

2. **Neue Zuarbeit & Inkrementelles Nachreichen:**
   - Beliebige Dokumente via Drag-and-Drop hochladen.
   - **Bestehende Vorgänge aktualisieren:** Fehlende Nachweise oder neue E-Mails können nachträglich über **„Unterlagen nachreichen“** in ein bestehendes Dossier eingepflegt werden, ohne verifizierte Daten zu verlieren.

3. **Multimodale KI-Analyse (Agentischer Workflow):**
   - **Autonome Dokumentenerkennung:** Klassifizierung nach Dokumententyp, Datum und Verlässlichkeit (`HIGH`, `MEDIUM`, `LOW`, `OBSOLETE`, `UNRELATED`).
   - **10 Fachspezifische Pflichtfelder (Ampelsystem):**
     - Verkäufer, Käufer, Grundbuch, Grundstücke, Kaufpreis, Finanzierung, Belastungen, Mietverhältnisse, Energieausweis, Übergabe.
     - Status je Feld: `Belegt` (`VERIFIED`), `Prüfung nötig` (`NEEDS_REVIEW`), `Veraltet` (`OUTDATED`), `Fehlt` (`MISSING`).
     - **Lückenloser Audit-Trail:** Jede Zahl und Angabe ist mit Dateiquelle, Seitenzahl und Original-Textzitat (`snippet`) belegt.
   - **Konnexitätsprüfung & Diskrepanzerkennung:** Fremde Parteien oder abweichende Liegenschaftsdaten werden isoliert; Kaufpreis-Historien (Vorangebot vs. finaler Stand) transparent dargestellt.
   - **Proaktive Nachforderungen (`inquiries`):** Konkrete Nachforderungen an Makler, Parteien oder Grundbuchamt mit 1-Klick-Kopierfunktion.

4. **Human-in-the-Loop & Export:**
   - Manuelle Statusanpassung und Notizfunktion für Sachbearbeiter.
   - 1-Klick-Kopieren des formatierten Prüfberichts für die Kanzleisoftware sowie strukturierter JSON-Export des vollständigen Dossiers.

---

## 🏗 Technische Architektur

- **Frontend:** Next.js 16 (App Router mit Turbopack), React 19, Tailwind CSS, Lucide Icons.
- **Agentic Engine:** Vercel AI SDK (`ai`), `@ai-sdk/anthropic` mit nativer PDF- und Bildverarbeitung (multimodale Vision), Zod-Schemavalidierung und robustem Fallback-Merging.
- **Backend & Datenspeicherung:** Next.js Route Handlers (`/api/analyze`, `/api/documents`), Supabase PostgreSQL mit hybridem In-Memory-Fallback für 100 % Ausfallsicherheit.
- **Code-Qualität & Standards:** Husky Pre-Commit Hooks, Lint-Staged, Prettier, ESLint, Vitest Test-Suite.
