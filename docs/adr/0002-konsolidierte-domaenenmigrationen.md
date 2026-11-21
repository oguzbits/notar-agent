# ADR 0002: Drei konsolidierte Domänenmigrationen

**Status:** Angenommen (rückwirkend dokumentiert)

## Kontext

Viele kleine Patch-Migrationen und Seed-Dateien machen das Schema schwer lesbar. AGENTS.md fordert deshalb „Zero Migration Fragmentation“ (Invariante 8).

## Entscheidung

`supabase/migrations/` enthält je Domäne eine Datei: `core_multi_tenancy`, `knowledge_and_vector`, `jobs_and_workflows`. Schema, Policies, Indizes und die zugehörigen Seed-Wissensdokumente liegen zusammen in der Domänendatei.

## Folgen

- Das Schema ist je Domäne an einer Stelle lesbar; Seeds und Policies driften nicht auseinander.
- Eine Änderung an einer bereits live eingespielten Datei erreicht die Live-Datenbank nicht von selbst. Änderungen werden einzeln von Hand eingespielt und verifiziert (Beispiel: B.11.2a im [CHANGELOG.md](../CHANGELOG.md)); bis dahin gilt der Stand `DECLARATION_STAGED` und die abhängige Änderung wird nicht veröffentlicht, weil ein Push auf `main` Produktion ausrollt.
- Ein automatischer Drift-Vergleich zwischen Migrationsdateien und Live-Schema fehlt. Der Nachweis läuft über `npm run test:db` gegen eine lokale Supabase und die Lese-Abfrage nach dem Einspielen.

## Verworfene Alternativen

Fortlaufend erzeugte, inkrementelle Migrationen (je Änderung eine Datei) hätten den Live-Abgleich automatisierbar gemacht, widersprechen aber der Invariante 8. Die Regel ist bewusst gesetzt; wer sie ändern will, ersetzt diesen Eintrag.
