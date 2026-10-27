import { CASE_TYPES } from '@/types/dossier';
import { RETRIEVAL_EVAL_CASE_KINDS as KIND, RetrievalEvalCase } from '@/types/eval';

/**
 * Eval-Gate der Wissenssuche: 48 synthetische, verrauschte Vorgänge (Notizen und Dateinamen), von Hand
 * geschrieben, keine Mandantendaten. Die Grundwahrheit nennt die Rechtsgrundlagen des Benchmark-Korpus.
 * Grenzen: Fälle selbst verfasst, kleines Korpus; Messbefund und Wiedervorlage im Backlog (§ 19).
 */
const c = (
  id: string,
  kind: RetrievalEvalCase['kind'],
  caseType: RetrievalEvalCase['caseType'],
  notes: string,
  fileNames: string[],
  relevantLegalBases: string[]
): RetrievalEvalCase => ({ id, kind, caseType, notes, fileNames, relevantLegalBases });

const KAUF = CASE_TYPES.IMMOBILIENKAUF;
const GMBH = CASE_TYPES.GMBH_GRUENDUNG;

export const RETRIEVAL_EVAL_CASES: RetrievalEvalCase[] = [
  c(
    'eval-kennung-01',
    KIND.KENNUNG,
    KAUF,
    'ETW Köln, Vorgang 2024/118. Verwalter hat noch nicht zugestimmt (§ 12 WEG), Käufer will Finanzierung über Grundschuld. Termin KW 14.',
    ['Kaufvertragsentwurf_Schmitz.pdf', 'Teilungserklaerung_scan.pdf'],
    ['§ 12 WEG']
  ),
  c(
    'eval-kennung-02',
    KIND.KENNUNG,
    KAUF,
    'GbR als Käuferin, Gesellschafterliste fehlt. Voreintragung? lt. § 47 II GBO + § 707 BGB prüfen!!',
    ['Gesellschaftsvertrag_GbR.pdf', 'GB_Auszug_Bl_8812.pdf'],
    ['§ 707 BGB, § 47 Abs. 2 GBO']
  ),
  c(
    'eval-kennung-03',
    KIND.KENNUNG,
    KAUF,
    'Neubau Bauträger, Ratenplan nach MaBV § 3 liegt vor, Abnahme noch offen. Kaufpreis 412.000.',
    ['Bautraegervertrag.pdf', 'Baubeschreibung.pdf'],
    ['§ 3 MaBV, § 650u BGB']
  ),
  c(
    'eval-kennung-04',
    KIND.KENNUNG,
    KAUF,
    'Vollmacht der Verkäuferin nur in Kopie (Rechtsanwalt unterschreibt), siehe § 172 BGB. Beglaubigung?',
    ['Vollmacht_Kopie.pdf', 'Personalausweis_V.pdf'],
    ['§ 172 BGB, § 29 GBO']
  ),
  c(
    'eval-kennung-05',
    KIND.KENNUNG,
    KAUF,
    'Mietshaus, 6 WE vermietet. Kauf bricht nicht Miete, § 566 BGB, Kautionen übergeben? Zusätzlich GrESt Unbedenklichkeit abwarten.',
    ['Mietvertraege_Paket.pdf', 'Kautionsliste.xlsx'],
    ['§ 566, § 566a BGB', '§ 22 GrEStG']
  ),
  c(
    'eval-kennung-06',
    KIND.KENNUNG,
    KAUF,
    'Mdl. Besprechung: Käufer ist Minderjähriger, Eltern handeln. Bitte § 1643 BGB checken und Genehmigung vorbereiten. Zeitdruck wg. Zinsbindung.',
    ['Geburtsurkunde.pdf', 'Kaufangebot.pdf'],
    ['§ 1643, § 1850 BGB']
  ),
  c(
    'eval-kennung-07',
    KIND.KENNUNG,
    KAUF,
    'Heizungsgesetz Nachweis? GEG § 80 Abs. 2, Energieausweis vom Verkäufer noch nicht da.',
    ['Energieausweis_fehlt.pdf', 'Exposé.pdf'],
    ['§ 80 Abs. 2 GEG']
  ),
  c(
    'eval-kennung-08',
    KIND.KENNUNG,
    KAUF,
    'Rückfrage Kosten: Kostenschuldner nach GNotKG § 29 klären, Wert 380k, Beurkundung Do.',
    ['Kostenberechnung_Entwurf.pdf'],
    ['§ 10, § 29, § 30 GNotKG']
  ),
  c(
    'eval-kennung-09',
    KIND.KENNUNG,
    KAUF,
    'Löschungsbewilligung der Sparkasse fehlt, Grundschuld Abt. III lfd. Nr. 2 (§ 875 BGB). Bank-Kürzel: SPK.',
    ['GB_Auszug_Bl_4711.pdf', 'Loeschungsbewilligung_fehlt.pdf'],
    ['§ 875 BGB, § 27 GBO']
  ),
  c(
    'eval-kennung-10',
    KIND.KENNUNG,
    KAUF,
    'Erbengemeinschaft verkauft Haus, 3 Erben, Erbschein beantragt; § 2040 BGB Verfügung nur gemeinsam. Notartermin verschoben.',
    ['Erbschein_Antrag.pdf', 'Testament_Kopie.pdf'],
    ['§ 2040 BGB, § 35 GBO']
  ),
  c(
    'eval-kennung-11',
    KIND.KENNUNG,
    KAUF,
    'Wohnung mit Mietpreisbindung, Sozialwohnung? WoBindG § 13 prüfen. Käufer Eigennutzer.',
    ['Foerderbescheid.pdf'],
    ['§ 13 WoBindG']
  ),
  c(
    'eval-kennung-12',
    KIND.KENNUNG,
    KAUF,
    'Gewerbehalle: Mieter kündigt, Frist § 580a Abs. 2 BGB, Mietvertrag von 2011.',
    ['Gewerbemietvertrag_2011.pdf'],
    ['§ 580a Abs. 2 BGB']
  ),
  c(
    'eval-kennung-13',
    KIND.KENNUNG,
    KAUF,
    'Vormerkung für Käufer eintragen (§ 883 BGB), Kaufpreis erst bei Eintragung fällig.',
    ['Kaufvertragsentwurf.pdf', 'GB_Auszug.pdf'],
    ['§ 883, § 885 BGB']
  ),
  c(
    'eval-kennung-14',
    KIND.KENNUNG,
    GMBH,
    'GmbH-Gründung Musterprotokoll § 2 Abs. 1a GmbHG, ein Gesellschafter, Sitz Bonn.',
    ['Musterprotokoll.pdf', 'Ausweis_GF.pdf'],
    ['§ 2 Abs. 1a GmbHG']
  ),
  c(
    'eval-kennung-15',
    KIND.KENNUNG,
    GMBH,
    'Stammkapital 25.000, Einzahlung nach § 7 Abs. 2 GmbHG nachgewiesen? Kontoauszug unklar.',
    ['Kontoauszug_Gruendung.pdf'],
    ['§ 7 Abs. 2, § 8 Abs. 2 GmbHG']
  ),
  c(
    'eval-kennung-16',
    KIND.KENNUNG,
    KAUF,
    'GwG-Identifizierung der wirtschaftlich Berechtigten, Käufer ist Holding in Luxemburg; BeurkG § 10 Angaben.',
    ['Handelsregister_Lux.pdf', 'Transparenzregister.pdf'],
    ['§ 10, § 11 GwG, § 10 BeurkG']
  ),
  c(
    'eval-kennung-17',
    KIND.KENNUNG,
    KAUF,
    'Bebauungsplan: GRZ 0,4, GFZ 0,8 laut BauNVO § 17, Anbau geplant.',
    ['Bebauungsplan_Auszug.pdf'],
    ['§ 16, § 17 BauNVO']
  ),
  c(
    'eval-kennung-18',
    KIND.KENNUNG,
    KAUF,
    'Zustimmung der Gemeinde nach BauGB § 144 im Sanierungsgebiet; Vorkaufsrecht § 24 BauGB prüfen.',
    ['Sanierungssatzung.pdf', 'Vorkaufsrechtsanfrage.pdf'],
    ['§ 144, § 145 BauGB', '§ 24, § 28 BauGB']
  ),
  c(
    'eval-kennung-19',
    KIND.KENNUNG,
    KAUF,
    'Vertretung ohne Vertretungsmacht, Genehmigung § 177 BGB nachholen, Frist läuft. Beglaubigung durch Notar vor Ort.',
    ['Genehmigungserklaerung_Entwurf.pdf'],
    ['§ 177, § 182 BGB']
  ),
  c(
    'eval-kennung-20',
    KIND.KENNUNG,
    KAUF,
    'Dienstbarkeit Wegerecht (§ 1018 BGB) für Nachbarn Flst. 12/4, Eintrag Abt. II.',
    ['Wegerechtsvereinbarung.pdf', 'Lageplan.pdf'],
    ['§ 1018 BGB, § 1020 BGB']
  ),
  c(
    'eval-ohne-kennung-01',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Telefonat mit Hr. Weber: Er verkauft das Elternhaus zusammen mit seiner Schwester und dem Bruder, Mutter ist vor zwei Jahren gestorben, einen Erbschein hat niemand. Käufer will schnell einziehen.',
    ['Notiz_Telefonat.pdf', 'Kaufangebot_Familie_Weber.pdf'],
    ['§ 2040 BGB, § 35 GBO']
  ),
  c(
    'eval-ohne-kennung-02',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Die Tochter (15) soll das Grundstück von der Oma bekommen, Eltern unterschreiben. Wohl auch Gericht nötig? Bitte klären bis Freitag.',
    ['Schenkungsentwurf.pdf'],
    ['§ 1643, § 1850 BGB']
  ),
  c(
    'eval-ohne-kennung-03',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Verkäufer wohnt in Spanien und schickt seinen Neffen mit einer Bescheinigung vom dortigen Notar. Original per Post unterwegs, bisher nur ein Foto davon.',
    ['Foto_Vollmacht.jpg', 'Kaufvertrag_Entwurf.pdf'],
    ['§ 172 BGB, § 29 GBO']
  ),
  c(
    'eval-ohne-kennung-04',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Mieterin im EG zahlt weiter an den alten Eigentümer, Mietvertrag unbefristet. Nach Eigentumswechsel Kaution und Miete wohin?',
    ['Mietvertrag_EG.pdf', 'Kaufvertrag.pdf'],
    ['§ 566, § 566a BGB']
  ),
  c(
    'eval-ohne-kennung-05',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Wir haben für beide Seiten einen Treuhandauftrag der Bank, das Geld soll erst raus, wenn die Löschung der alten Grundschuld da ist und die Eintragung gesichert ist.',
    ['Treuhandauftrag_Bank.pdf', 'Loeschung_Entwurf.pdf'],
    ['§ 54a BeurkG, § 57 DONot', '§ 875 BGB, § 27 GBO']
  ),
  c(
    'eval-ohne-kennung-06',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Das Finanzamt hat sich noch nicht gemeldet, ohne die Bescheinigung darf der Käufer nicht ins Grundbuch. Bitte nachfassen.',
    ['Anzeige_Finanzamt.pdf'],
    ['§ 22 GrEStG']
  ),
  c(
    'eval-ohne-kennung-07',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Verkäufer schließt jede Haftung für Mängel aus, obwohl er weiß, dass der Keller feucht ist. Käuferin ist Privatperson. Bitte Formulierung prüfen.',
    ['Kaufvertragsentwurf_V3.pdf', 'Gutachten_Keller.pdf'],
    ['§ 434, § 442, § 444 BGB']
  ),
  c(
    'eval-ohne-kennung-08',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Käufer soll gesichert werden bis zur Umschreibung, falls der Verkäufer es doppelt verkauft oder jemand pfändet. Eintrag im Grundbuch vor Zahlung.',
    ['Kaufvertragsentwurf.pdf'],
    ['§ 883, § 885 BGB']
  ),
  c(
    'eval-ohne-kennung-09',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Der Käufer zahlt über eine Firma im Ausland, die Mitarbeiterin der Bank wollte wissen, wer eigentlich dahintersteckt und woher das Geld kommt.',
    ['Geldwaesche_Fragebogen.pdf', 'Kaufvertrag.pdf'],
    ['§ 10, § 11 GwG, § 10 BeurkG']
  ),
  c(
    'eval-ohne-kennung-10',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Ein Streifen am Ende des Gartens (ca. 80 qm) soll an den Nachbarn gehen, Vermessung ist beauftragt, noch kein Ergebnis. Beurkundung vorher möglich?',
    ['Vermessungsauftrag.pdf', 'Skizze_Grenze.pdf'],
    ['DNotI-Report 2020/04, § 2 Abs. 3 GBO']
  ),
  c(
    'eval-ohne-kennung-11',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Die Stadt hat angeschrieben, wegen Sanierung brauchen wir ihre Zustimmung zum Verkauf. Außerdem fragt die Stadt, ob sie das Haus selbst kaufen will.',
    ['Schreiben_Stadt.pdf'],
    ['§ 144, § 145 BauGB', '§ 24, § 28 BauGB']
  ),
  c(
    'eval-ohne-kennung-12',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Wer zahlt die Notarrechnung? Verkäufer sagt Käufer, Käufer sagt halbe-halbe. Rechnung geht an wen?',
    ['Kostenrechnung.pdf'],
    ['§ 10, § 29, § 30 GNotKG']
  ),
  c(
    'eval-ohne-kennung-13',
    KIND.OHNE_KENNUNG,
    GMBH,
    'Gesellschafter will die GmbH schnell gründen, ohne langen Vertrag, nur das Standardformular. Geld ist noch nicht eingezahlt.',
    ['Formular_Standard.pdf'],
    ['§ 2 Abs. 1a GmbHG', '§ 7 Abs. 2, § 8 Abs. 2 GmbHG']
  ),
  c(
    'eval-ohne-kennung-14',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Betreuer unterschreibt für den Eigentümer, der im Pflegeheim lebt. Beschluss des Gerichts liegt dem Büro nicht vor.',
    ['Betreuerausweis.pdf', 'Pflegeheim_Brief.pdf'],
    ['§ 1850 BGB']
  ),
  c(
    'eval-ohne-kennung-15',
    KIND.OHNE_KENNUNG,
    GMBH,
    'Der Verkäufer hat die Firma ins Handelsregister eintragen lassen, aber die Vertretungsberechtigung ist unklar, Auszug alt.',
    ['HR_Auszug_alt.pdf'],
    ['§ 12 HGB, § 21 BNotO']
  ),
  c(
    'eval-ohne-kennung-16',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Verwalter muss dem Verkauf zustimmen, so steht es in der Teilungserklärung. Wann bekommen wir seine Erklärung?',
    ['Teilungserklaerung.pdf', 'Verwalter_Mail.pdf'],
    ['§ 12 WEG']
  ),
  c(
    'eval-ohne-kennung-17',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Der Gesellschaft gehören die Anteile, sie ist noch nicht eingetragen, trotzdem soll sie Eigentümerin werden.',
    ['Gesellschaftsvertrag.pdf'],
    ['§ 707 BGB, § 47 Abs. 2 GBO']
  ),
  c(
    'eval-ohne-kennung-18',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Energieausweis fehlt komplett, Käufer fragt ob Pflicht zur Beratung zum Heizungstausch besteht.',
    ['Exposé.pdf'],
    ['§ 80 Abs. 2 GEG']
  ),
  c(
    'eval-ohne-kennung-19',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Das Haus ist ein Sozialwohnungsbestand, gefördert, dürfen wir an Selbstnutzer verkaufen?',
    ['Foerderbescheid_alt.pdf'],
    ['§ 13 WoBindG']
  ),
  c(
    'eval-ohne-kennung-20',
    KIND.OHNE_KENNUNG,
    KAUF,
    'Die Firma hat ein altes Grundstück mit Lagerhalle, Pächter will verlängern, Kündigungsfristen im Vertrag unklar.',
    ['Pachtvertrag.pdf'],
    ['§ 580a Abs. 2 BGB']
  ),
  c(
    'eval-ohne-treffer-01',
    KIND.OHNE_TREFFER,
    KAUF,
    'Geburtstagsgrüße vom Büro an die Mandantin. Termin am Donnerstag um 10 Uhr, Parkplatz im Hof.',
    ['Einladung.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-02',
    KIND.OHNE_TREFFER,
    KAUF,
    'Der Drucker im Sekretariat ist kaputt, bitte Beurkundungsentwurf per Mail schicken statt auszudrucken.',
    ['Entwurf.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-03',
    KIND.OHNE_TREFFER,
    KAUF,
    'Mandant fragt nach dem Stand seiner Eheverträge und Erbverträge, nichts zum Grundstück.',
    ['Ehevertrag_alt.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-04',
    KIND.OHNE_TREFFER,
    KAUF,
    'Testamentsänderung, Enkelin soll das Auto bekommen, kein Grundbesitz vorhanden.',
    ['Testament.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-05',
    KIND.OHNE_TREFFER,
    KAUF,
    'Unterschriftsbeglaubigung für eine Reisevollmacht der Kinder, kein Grundstück.',
    ['Reisevollmacht.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-06',
    KIND.OHNE_TREFFER,
    KAUF,
    'Rückfrage zur Rechnung vom Vormonat, Mandant hat Skonto abgezogen.',
    ['Rechnung_Vormonat.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-07',
    KIND.OHNE_TREFFER,
    KAUF,
    'Vorsorgevollmacht für Ehepaar, bitte Termin in zwei Wochen, keine Immobilien.',
    ['Vorsorgevollmacht_Entwurf.pdf'],
    []
  ),
  c(
    'eval-ohne-treffer-08',
    KIND.OHNE_TREFFER,
    KAUF,
    'Neue Mitarbeiterin ab Montag, bitte Zugang zum Aktensystem einrichten.',
    ['Personalbogen.pdf'],
    []
  ),
];
