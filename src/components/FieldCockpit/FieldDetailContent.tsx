import React from 'react';
import { Dossier, ImmobilienFields } from '@/types/dossier';
import {
  Building2,
  UserCheck,
  BookOpen,
  MapPin,
  Coins,
  Landmark,
  ShieldAlert,
  Home,
  Zap,
  Key,
} from 'lucide-react';
import { formatDateGerman, formatOwnerEntry, cleanTextValue } from '@/lib/formatters';

interface FieldDetailContentProps {
  fieldKey: string;
  dossier: Dossier;
}

export const FieldDetailContent: React.FC<FieldDetailContentProps> = ({ fieldKey, dossier }) => {
  const fields = dossier.fields as ImmobilienFields;

  switch (fieldKey) {
    case 'verkaeufer':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {cleanTextValue(fields.verkaeufer.data?.name) || '—'}
            </span>
            {cleanTextValue(fields.verkaeufer.data?.legalForm) && (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                {cleanTextValue(fields.verkaeufer.data?.legalForm)}
              </span>
            )}
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <div>
              <strong className="text-foreground">Eigentümerin laut Grundbuch:</strong>{' '}
              {fields.verkaeufer.data?.registeredOwnersGrundbuch &&
              fields.verkaeufer.data.registeredOwnersGrundbuch.length > 0 ? (
                <span className="text-foreground font-medium">
                  {fields.verkaeufer.data.registeredOwnersGrundbuch
                    .map((owner: unknown) => formatOwnerEntry(owner))
                    .join('; ')}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div>
              <strong className="text-foreground">Vertretungsberechtigte:</strong>{' '}
              {fields.verkaeufer.data?.authorizedRepresentatives &&
              fields.verkaeufer.data.authorizedRepresentatives.length > 0 ? (
                <span className="text-foreground font-medium">
                  {fields.verkaeufer.data.authorizedRepresentatives.join(', ')}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-foreground font-medium">Nachweise vorliegend:</span>{' '}
              {fields.verkaeufer.data?.representationProofProvided ? (
                <span className="font-semibold text-emerald-800">Vollständig</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      );

    case 'kaeufer': {
      const court = cleanTextValue(fields.kaeufer.data?.registerCourt);
      const regNum = cleanTextValue(fields.kaeufer.data?.registerNumber);
      const address = cleanTextValue(fields.kaeufer.data?.address);
      const legalForm = cleanTextValue(fields.kaeufer.data?.legalForm);
      const companyName = cleanTextValue(fields.kaeufer.data?.companyName);

      const hrDisplay = court && regNum ? `${court}, ${regNum}` : court || regNum || null;

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">{companyName || '—'}</span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p>
              <strong className="text-foreground">Rechtsform:</strong> {legalForm || '—'}
            </p>
            <p>
              <strong className="text-foreground">Handelsregister:</strong>{' '}
              {hrDisplay ? (
                <span className="text-foreground font-medium">{hrDisplay}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p>
              <strong className="text-foreground">Geschäftsanschrift:</strong>{' '}
              {address ? (
                <span className="text-foreground font-medium">{address}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p>
              <strong className="text-foreground">Amtlicher Nachweis:</strong>{' '}
              {fields.kaeufer.data?.hasOfficialRegisterProof ? (
                <span className="font-semibold text-emerald-800">
                  Amtlicher HR-Auszug liegt vor
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>
      );
    }

    case 'grundbuch':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.grundbuch.data?.amtsgericht || fields.grundbuch.data?.grundbuchBezirk
                ? `Amtsgericht ${fields.grundbuch.data?.amtsgericht || '—'}, Grundbuch von ${fields.grundbuch.data?.grundbuchBezirk || '—'}`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p>
              <strong className="text-foreground">Blattnummer:</strong>{' '}
              <span className="text-foreground font-medium">
                {fields.grundbuch.data?.blatt || '—'}
              </span>
            </p>
            <p>
              <strong className="text-foreground">Stand des Auszugs:</strong>{' '}
              {fields.grundbuch.data?.standDatum ? (
                <span className="text-foreground font-medium">
                  {formatDateGerman(fields.grundbuch.data.standDatum)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>
      );

    case 'grundstuecke':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.grundstuecke.data?.parcels && fields.grundstuecke.data.parcels.length > 0
                ? `${fields.grundstuecke.data.parcels.length} Flurstück(e) erfasst`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1.5 text-base">
            {fields.grundstuecke.data?.parcels?.map((p, idx) => (
              <div key={idx} className="bg-muted/50 border-border rounded-md border p-2 text-base">
                <span className="text-foreground font-medium">
                  Flurstück <strong>{p.flurstueckNummer || '—'}</strong> (Flur {p.flur || '—'},{' '}
                  {p.gemarkung || '—'})
                </span>
                <div className="text-muted-foreground mt-0.5 text-base">
                  Fläche: {p.sizeM2 ? `${p.sizeM2} m²` : 'unbekannt'} |{' '}
                  {p.wirtschaftsart || 'Wirtschaftsart nicht angegeben'}
                </div>
              </div>
            ))}
            {Boolean(
              fields.grundstuecke.data?.totalAreaM2 && fields.grundstuecke.data.totalAreaM2 > 0
            ) && (
              <p className="text-foreground pt-1 font-semibold">
                Gesamtfläche: {fields.grundstuecke.data!.totalAreaM2} m²
              </p>
            )}
          </div>
        </div>
      );

    case 'kaufpreis':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 shrink-0 text-[#4D9619]" />
            <span className="text-foreground text-base font-bold">
              {fields.kaufpreis.data?.amountInFigures
                ? `${fields.kaufpreis.data.amountInFigures.toLocaleString('de-DE')} EUR`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p className="text-foreground italic">
              In Worten: <strong>{fields.kaufpreis.data?.amountInWords || '—'}</strong>
            </p>
            {fields.kaufpreis.data?.priceEvolutionSummary && (
              <div className="bg-muted/60 border-border text-foreground rounded-md border p-2.5 text-base">
                <strong className="text-[#356611]">Verhandlungshistorie:</strong>{' '}
                {fields.kaufpreis.data.priceEvolutionSummary}
              </div>
            )}
          </div>
        </div>
      );

    case 'finanzierung':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Landmark className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.finanzierung.data?.lenderName || '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p>
              <strong className="text-foreground">Grundschuldbetrag:</strong>{' '}
              {fields.finanzierung.data?.mortgageAmount ? (
                <span className="text-foreground font-medium">{`${fields.finanzierung.data.mortgageAmount.toLocaleString('de-DE')} EUR`}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p>
              <strong className="text-foreground">Finanzierungsvollmacht im Vertrag:</strong>{' '}
              {fields.finanzierung.data?.requiresFinancingPowerOfAttorney ? (
                <span className="font-semibold text-emerald-800">Ja (Standardklausel)</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>
      );

    case 'belastungen':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.belastungen.data?.entries && fields.belastungen.data.entries.length > 0
                ? `${fields.belastungen.data.entries.length} Eintragung(en) verzeichnet`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground max-h-60 space-y-2 overflow-y-auto pr-1 text-base">
            {fields.belastungen.data?.entries?.map((b, idx) => (
              <div key={idx} className="bg-muted/50 border-border rounded-md border p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">
                    Abt. {b.section} Nr. {b.runningNumber || '—'}
                  </span>
                  <span className="bg-background border-border text-foreground rounded border px-2 py-0.5 font-mono text-xs uppercase">
                    {b.intendedHandling}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 text-base">
                  {b.description} {b.amount ? `(${b.amount})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'mietverhaeltnisse':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Home className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.mietverhaeltnisse.data?.yearlyNetRent
                ? `${fields.mietverhaeltnisse.data.yearlyNetRent.toLocaleString('de-DE')} EUR p.a.`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p>
              <strong className="text-foreground">Vollvermietung:</strong>{' '}
              {fields.mietverhaeltnisse.data?.fullRentedStatus ? 'Laut Angabe ja' : '—'}
            </p>
            <p>
              <strong className="text-foreground">Fläche:</strong>{' '}
              {fields.mietverhaeltnisse.data?.rentableAreaM2
                ? `${fields.mietverhaeltnisse.data.rentableAreaM2} m²`
                : '—'}{' '}
              |<strong className="text-foreground"> Einheiten:</strong>{' '}
              {fields.mietverhaeltnisse.data?.unitCount
                ? fields.mietverhaeltnisse.data.unitCount
                : '—'}
            </p>
            {fields.mietverhaeltnisse.data?.privacyOrRedactionNotes && (
              <p className="text-muted-foreground text-base">
                {fields.mietverhaeltnisse.data.privacyOrRedactionNotes}
              </p>
            )}
            {fields.mietverhaeltnisse.data?.tenancyTransferNotes && (
              <p className="text-muted-foreground text-base">
                <strong className="text-foreground">§ 566 BGB Übergang:</strong>{' '}
                {fields.mietverhaeltnisse.data.tenancyTransferNotes}
              </p>
            )}
          </div>
        </div>
      );

    case 'energieausweis':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-foreground font-semibold">
              {fields.energieausweis.data?.certificateType &&
              fields.energieausweis.data.certificateType !== 'UNBEKANNT'
                ? fields.energieausweis.data.certificateType
                : '—'}{' '}
              {fields.energieausweis.data?.efficiencyClass
                ? `(Klasse ${fields.energieausweis.data.efficiencyClass})`
                : ''}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p>
              <strong className="text-foreground">Endenergiewert:</strong>{' '}
              {fields.energieausweis.data?.energyValueKWh
                ? `${fields.energieausweis.data.energyValueKWh} kWh/(m²*a)`
                : '—'}
            </p>
            <p>
              <strong className="text-foreground">Gültig bis:</strong>{' '}
              {formatDateGerman(fields.energieausweis.data?.validUntil)}{' '}
              {fields.energieausweis.data?.isExpired && (
                <span className="font-semibold text-rose-700">(ABGELAUFEN)</span>
              )}
            </p>
            <p>
              <strong className="text-foreground">Energieträger:</strong>{' '}
              {fields.energieausweis.data?.primaryEnergyCarrier || '—'} |{' '}
              <strong className="text-foreground">Baujahr:</strong>{' '}
              {fields.energieausweis.data?.buildingYear || '—'}
            </p>
          </div>
        </div>
      );

    case 'uebergabe':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Key className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              Geplant zum: {formatDateGerman(fields.uebergabe.data?.targetDate)}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-base">
            <p>
              <strong className="text-foreground">Regelung:</strong>{' '}
              {fields.uebergabe.data?.conditionDescription || '—'}
            </p>
            {fields.uebergabe.data?.riskTransferNotes && (
              <p className="text-muted-foreground text-base">
                {fields.uebergabe.data.riskTransferNotes}
              </p>
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
};
