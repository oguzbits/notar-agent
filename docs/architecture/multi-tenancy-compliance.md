# Mandantenfähigkeit & Kanzlei-Isolation (§ 203 StGB)

> **Architektur-Spezifikation:** Kernel-Level Row-Level Security & Revisionssicherheit  
> **Kernkomponenten:** PostgreSQL RLS, `audit_logs`, `src/types/organization.ts`, `src/lib/auth/rbac.ts`

---

## 1. Das berufsrechtliche Gebot der strikten Trennung

Notariate unterliegen der berufsrechtlichen Verschwiegenheitspflicht (§ 18 BNotO) und dem strafbewehrten Berufsgeheimnis (§ 203 StGB). In einem mandantenfähigen Cloud-Setup darf unter keinen Umständen ein Datenabfluss zwischen verschiedenen Kanzleien (Tenants) oder innerhalb einer Sozietät bei Mandatskonflikten möglich sein.

---

## 2. Row-Level Security (RLS) im PostgreSQL Kernel

Statt Mandantentrennung fehleranfällig im TypeScript-Applikationscode zu verwalten, erzwingt die Architektur **Row-Level Security (RLS)** direkt auf Datenbank-Kernel-Ebene:

```sql
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON dossiers
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);
```

- Alle Tabellen besitzen zwingend eine Fremdschlüssel-Beziehung zu `organizations`.
- Supabase SSR Sessions lösen die Identität des Kanzleimitglieds serverseitig auf. Spoofbare Client-IDs sind verboten.

---

## 3. Rollen- und Rechtematrix (Kanzlei-RBAC)

| Rolle                         | Typische Person         | Berechtigungen im System                                                                                                                       |
| :---------------------------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **`NOTAR` / `NOTARASSESSOR`** | Amtsträger              | Vollzugriff: Letztentscheidung über Freigaben, finale Status-Overrides, Export in Fachverfahren, Einsicht in unveränderliche Audit-Logs.       |
| **`SACHBEARBEITER`**          | Notarfachangestellte(r) | Operativer Zugriff: Akten-Upload, Klärung von `NEEDS_REVIEW`, Einpflegen von Notizen und Nachträgen, Begründung von Warnungen.                 |
| **`ANWALTSNOTAR_RA`**         | Partner / RA            | Selektiver Zugriff: Nur Einsicht in Akten ohne Mandatskonflikte (§ 43a BRAO).                                                                  |
| **`ADMIN`**                   | Kanzlei-Administrator   | Technischer Zugriff: Mitarbeiter-Einladungen, Rollenzuweisungen, Schnittstellenanbindung – kein Einblick in Mandantenakten ohne Audit-Eintrag. |

---

## 4. Revisionssicherer Audit-Trail (§ 17 ff. BeurkG)

- **Append-Only Event-Tabelle:** `audit_logs` protokolliert jede Modifikation (Status-Overrides, Exporte, Berechtigungsänderungen).
- **Kryptografische Integrität:** Jeder Datensatz ist über SHA-256 mit dem Hash des Vorgängers verkettet (Hash-Chaining).
- **Zwingende Begründung:** Bei manuellem Herabstufen einer KI-Warnung (`NEEDS_REVIEW` $\rightarrow$ `VERIFIED`) muss eine juristische Begründung hinterlegt werden.
