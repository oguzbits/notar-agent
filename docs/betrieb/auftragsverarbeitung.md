# Auftragsverarbeitung und Datenverbleib

> **Zweck:** Welche Dienstleister Mandantendaten verarbeiten, wo, und was vertraglich noch zu klären ist. Stand der Anbieterangaben: 02.11.2026 (Recherche in der jeweiligen Anbieter-Dokumentation); vor Vertragsabschluss gegen die Originalquelle prüfen. **Keine Rechtsberatung.** Offene Punkte stehen in [ROADMAP.md](../ROADMAP.md) (C.7).

## 1. Verarbeiter

| Dienst          | Zweck                                 | Daten                                                                                                 | Region                                                                 | Vertrag (AVV/DPA)                                                                                                                                    |
| --------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase        | Datenbank, Auth, Dateispeicher        | alle Vorgangs- und Kontodaten, Originaldateien                                                        | `eu-central-1` (Frankfurt)                                             | DPA Teil der Nutzungsbedingungen, [supabase.com/legal/dpa](https://supabase.com/legal/dpa); Unterauftragsverarbeiter-Liste auf der Supabase-Webseite |
| Vercel          | Betrieb der App und API               | Anfragen mit Dokumentinhalten im Arbeitsspeicher                                                      | `fra1` seit Commit a837a13 (zuvor Standardregion `iad1`, Washington)   | DPA [vercel.com/legal/dpa](https://vercel.com/legal/dpa); Geltungsbereich je Plan unklar, Subprozessoren unter security.vercel.com                   |
| Anthropic       | Dokumentanalyse (Stufe 1 und 2)       | Dokumenttexte und -bilder der Vorgänge                                                                | nur `us` oder `global`, keine EU-Option (Anthropic-Datenresidenz-Doku) | Commercial Terms verweisen auf ein Data Processing Addendum; Abrufweg zu klären                                                                      |
| Google (Gemini) | Lesen von Scans und Tabellen (Vision) | Seitenbilder und Texte der Vorgänge                                                                   | je nach Zugang; EU-Residenz nicht belegt                               | bei bezahltem Gemini-API-Zugang DPA; Vertex AI: Cloud Data Processing Addendum                                                                       |
| Sentry          | Fehlerbericht                         | Fehler ohne Personenbezug (Scrubbing in [scrub-event.ts](../../src/lib/observability/scrub-event.ts)) | EU (Frankfurt), nur mit gesetztem DSN                                  | DPA [sentry.io/legal/dpa](https://sentry.io/legal/dpa/); laut Anbieter sind Übermittlungen in die USA möglich                                        |

## 2. Befunde

1. **Anthropic hat keine EU-Verarbeitung.** `inference_geo` kennt nur `us` und `global`. Notariatsunterlagen verlassen damit bei jeder Analyse die EU. Ob das mit dem Berufsgeheimnis (§ 203 StGB) und den Mandantenerwartungen vereinbar ist, entscheidet die Betreiberin bzw. der Betreiber mit Rechtsberatung; mögliche Wege: Anbieter mit EU-Verarbeitung, Einwilligung und Verschwiegenheitsverpflichtung der Dienstleister nach § 203 Abs. 3 StGB, Schwärzung vor dem Versand.
2. **Zero Data Retention ist bei Anthropic nur auf Anfrage und je Organisation möglich**, nicht automatisch. Ob das eingesetzte Modell abgedeckt ist, steht in der Anthropic-Dokumentation zur Datenaufbewahrung; die Recherche konnte das für das Standardmodell der App nicht belegen. Ohne ZDR gilt die Standardaufbewahrung des Anbieters (Frist nicht belegt).
3. **Training:** Nach den Commercial Terms darf Anthropic nicht mit Kundeninhalten aus den Diensten trainieren. Bei Google trainiert der **unbezahlte** Gemini-API-Zugang (mit menschlicher Durchsicht); der bezahlte Zugang trainiert nicht. **Der API-Schlüssel für Gemini muss deshalb ein bezahlter sein**; das lässt sich nur im Google-Konto prüfen, nicht im Code.
4. **Vercel lief bis zum Commit a837a13 in Washington.** Mit `regions: ["fra1"]` laufen Funktionen in Frankfurt; wirksam wird das erst mit dem nächsten Produktions-Deployment.
5. **Gemini-EU-Residenz:** Bei Vertex AI ist ZDR konfigurierbar (kein Logging, kein Caching); eine EU-Region ist in der gelesenen Quelle nicht belegt.

## 3. Zu klären durch Betreiber (außerhalb des Codes)

- Abschluss bzw. Ablage der AVV/DPA mit Supabase, Vercel, Anthropic, Google und Sentry; Verzeichnis der Verarbeitungstätigkeiten und Datenschutz-Folgenabschätzung für die Kanzleien.
- Entscheidung zu Befund 1 und 2 (Anthropic: EU, ZDR).
- Bestätigung, dass der Gemini-Schlüssel zu einem bezahlten Konto gehört.
- Verschwiegenheitsverpflichtung der Dienstleister nach § 203 Abs. 3 StGB.
