# Feature-Studie Harvey und Legora mit Abgleich (Stand 2026-10-17)

Zweck: Entscheidungsgrundlage, welche Fähigkeiten der Anbieter zu einem Notariats-Produkt passen und wo wir es besser machen können. Ergänzt die [Referenzstudie](2026-10-15-legal-ai-referenzstudie.md) (Design) um Funktionen.

## Methode und Grenzen

- Nur öffentliche Quellen ohne Login: Produktseiten, Release Notes (Harvey, Okt 2025 bis Okt 2026), Newsroom und Blogs. Es wurde keine Anwendung benutzt, analysiert oder automatisiert ausgelesen. Beide Anbieter verbieten Reverse Engineering und automatisiertes Auslesen ihrer Apps (Harvey Platform Agreement 3.2(iii) und (iv), Legora Acceptable Use Policy); Legora verbietet zudem den Bau eines konkurrierenden Produkts. Ein Demo- oder Testkonto würde diese Bedingungen binden und ist deshalb nicht Teil dieser Studie.
- Alle Anbieteraussagen sind Herstellerangaben. Genauigkeits- und Zeitersparnis-Zahlen ohne genannte Methodik gelten als unsicher.
- Übernommen werden Fähigkeiten und Arbeitsabläufe als Ideen, kein geschützter Ausdruck.
- Unser Ist-Stand stammt aus der [Bestandsaufnahme](2026-10-16-bestandsaufnahme.md), den Architekturdokumenten und zwei Stichproben im Code (Playbooks, Beleg-Prüfung). Der Live-Stand der Datenbank wurde nicht geprüft.

## Matrix

| Fähigkeit                                                       | Harvey                                                                   | Legora                                                           | Unser Stand                                                                                   | Urteil                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Review-Tabelle (Dokument je Zeile, Frage je Spalte, Zellstatus) | belegt: Kommentare, Zellsperre, Inline-Bearbeitung, bedingte Spalten     | belegt: „Mark as Reviewed", „Lock Cells"                         | Cockpit-Tabelle mit festen Pflichtfeldern je Dossier und Status-Override; keine freien Fragen | Passt anders: Das Notariat braucht feste Prüfpunkte, keine freien Fragen. Zellstatus offen, geprüft, beanstandet fehlt. |
| Beleg pro Aussage                                               | Versprechen „every claim is backed by a citation", Satzquellen in Zellen | Versprechen „cited to its source", Darstellung nicht beschrieben | Schema mit Datei, Seite, Ausschnitt; Prüfung bei Scans lückenhaft (F01, P0)                   | Größte Chance. Beide versprechen es, keiner belegt Genauigkeit unabhängig.                                              |
| Playbooks                                                       | belegt: Builder, Prüfung in Word                                         | belegt: Startposition, Red Lines, Ausweichpositionen             | im Code nicht vorhanden; Regeln liegen deklarativ in `knowledge_documents`                    | Fehlt als Produktfunktion. Der Datenansatz trägt es, es fehlt die Bedienung.                                            |
| Prüfplan vor der Ausführung                                     | belegt: Plan, Freigabe, Nudges                                           | belegt: Plan, Selbstprüfung, Freigabe                            | nur geplant (BACKLOG §21)                                                                     | Fehlt, passt gut zu „Prüfung durch Notar erforderlich".                                                                 |
| Audit-Trail                                                     | belegt: filter- und exportierbar im Command Center                       | Herstellerangabe je Tool-Aufruf, Inhalt nicht gefunden           | append-only mit Hash-Kette, Abruf je Dokument                                                 | Vorsprung: Hash-Kette ist bei beiden nicht belegt. Gesamtexport fehlt.                                                  |
| Löschung und Aufbewahrung                                       | Vault-Papierkorb 30 Tage, mandatsbezogene Aufbewahrung                   | Fristen durch Kunden, Export vor Löschung                        | Löschpipeline, Fristen in SQL, Nachweis; rechtliche Klärung offen (BACKLOG §20)               | Vorsprung bei Nachweisbarkeit, rechtlich noch nicht abgeschlossen.                                                      |
| Rollen und Rechte                                               | SCIM, Space-Admin, Freigabestufen Run/View/Edit/Full                     | Rollen, Ethical Walls (Einzelquelle)                             | serverseitiges RBAC; Rechte-Editor fehlt                                                      | Gleichstand im Kern; SCIM nicht nötig.                                                                                  |
| Mandantentrennung und Datenresidenz                             | Azure, Verarbeitung EU/Schweiz oder Australien                           | technisch nicht beschrieben                                      | RLS mit `organization_id`; Region der Datenbank nicht geprüft                                 | Offen: Region und Live-Policies prüfen (BACKLOG §21), dann als Merkmal nutzbar.                                         |
| Qualitätsnachweis                                               | BigLaw Bench veröffentlicht, Scores nach Modell                          | keine Zahlen gefunden                                            | Eval-Framework; Benchmark mit 100+ Fällen offen (ROADMAP A.4.3)                               | Chance: Es gibt keinen veröffentlichten Benchmark für Notariatsaufgaben.                                                |
| Deutsches Recht und Format                                      | Otto Schmidt belegt, Tirant lo Blanch (ES, MX, CL)                       | deutsche Rechtsinhalte nicht belegt                              | Wissen zu BeurkG und Grundbuch in `knowledge_documents`; XJustiz offen (ROADMAP C.5)          | Vorsprung in der Domäne. Ein XJustiz-Export ist in beiden Katalogen nicht gefunden.                                     |
| Word, Outlook, DMS-Anbindung                                    | breit: Word, Outlook, iManage, NetDocuments, SharePoint                  | Word, Outlook, iManage                                           | Export-Ansicht; keine Anbindung                                                               | Zurückstellen. Zielsysteme im Notariat sind Fachverfahren, nicht Word-Add-ins.                                          |
| Intake, Monitors, Skills, Portal, Echtzeit-Zusammenarbeit       | teils (Shared Spaces, Gastkonten)                                        | belegt                                                           | nicht vorhanden                                                                               | Passt nicht zum aktuellen Fokus; später prüfen.                                                                         |

## Ergänzung: deutsche Vergleichsgruppe (öffentliche Quellen, Stand 2026-10-17)

Für ein Notariat sind Notarsoftware und deutsche Legal-KI die näheren Wettbewerber. Alle Angaben sind Herstellerangaben, mehrere Herstellerseiten waren nur als Suchauszug lesbar.

| Anbieter                            | Funktionen (belegt)                                                                                           | XJustiz                                                     | Beleg-/Zitatprüfung |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------- |
| TriNotar Expert AI (Wolters Kluwer) | Vertrags- und Dokumentenanalyse, Document Chat, Case Chat, optional Anonymisierung, semantische Suche mit OCR | Änderungshistorie nennt XJustiz 3.6.2, Details nicht belegt | nicht belegt        |
| wz-it (KI-Plattform für Notariate)  | Grundbuchauszüge auslesen, Treuhandauflagen zusammenfassen, Entwurfsvorbereitung                              | nicht genannt                                               | nicht genannt       |
| NoRA Advanced                       | KI-Assistent laut Drittprofil, Herstellerseite nicht geprüft                                                  | nicht gefunden                                              | nicht gefunden      |
| Beck-Noxtua, Libra, Legalfly        | Recherche, Entwurf, Prüfung für Kanzleien und Rechtsabteilungen                                               | nicht genannt                                               | nicht genannt       |
| XNotar (NotarNet)                   | Registeranmeldungen, Import aus XJustiz-XML (Handbuch von 2015)                                               | ja                                                          | keine KI            |

Nicht gefunden: Notar 4.0 und RA-MICRO KI, Fristenfunktionen, Kammer-Zertifizierung für KI-Software. Daraus folgt: Belegprüfung mit Fundstelle ist im Notariat bei keinem Anbieter belegt; TriNotar ist der Maßstab für den Funktionsumfang, wz-it für die Grundbuch-Auswertung.

## Was uns besser machen würde (Rangfolge)

1. **Belege auch bei Scans prüfen und bei Zweifel auf „Prüfung nötig" setzen (F01, fail-closed).** Voraussetzung für das Kernversprechen. Ohne diese Korrektur wäre jeder Beleg-Vorsprung unglaubwürdig.
2. **Prüfbarer Beleg im Cockpit:** Fundstelle mit Seite und Ausschnitt, Zellstatus offen, geprüft, beanstandet, Freigabe durch den Notar. Das ist der Unterschied zwischen „Beleg behauptet" und „Beleg nachprüfbar".
3. **Prüfplan vor dem Lauf mit Freigabe**, gespeist aus der vorhandenen Wissensbasis statt aus fest verdrahteten Regeln.
4. **Veröffentlichter, reproduzierbarer Notariats-Benchmark** (ROADMAP A.4.3), inklusive Messung der Belegtreue. Das ist der Hebel, den beide Anbieter nicht bedienen.
5. **XJustiz-Export und Nachbeurkundungs-Workflows** (ROADMAP C.4 und C.5): eigene Domäne, nicht kopierbar durch allgemeine Legal-AI.

Playbooks sind als Bedienkonzept sinnvoll, aber erst nach 1 bis 3, weil sie auf belegten Befunden aufbauen.

## Lücken dieser Studie

- Die Apps wurden nicht gesehen; Dichte, Zellstatus-Logik und die Darstellung der Belege sind unbekannt.
- Mehrere Zahlen und Zertifikate sind Herstellerangaben ohne Gegenprüfung (SOC 2 Umfang, „bis 5,5-mal schneller", „85 % weniger Prüfzeit", BigLaw-Bench-Scores).
- Legoras Hilfe-Center und Release Notes liegen hinter dem Login; Harveys Hilfe-Artikel wurden bis auf einen nicht gelesen.
- Unsere eigene Dokumentation widerspricht sich an zwei Stellen (Insert-Policy und Routen-Auth in der Übersicht, `FOR UPDATE SKIP LOCKED` in der Job-Doku); diese Studie folgt der jüngeren Bestandsaufnahme.
