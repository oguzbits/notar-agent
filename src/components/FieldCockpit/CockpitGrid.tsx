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
import React from 'react';
import { formatDateGerman, formatOwnerEntry, cleanTextValue } from '@/lib/formatters';
import { Dossier, FieldStatus, ImmobilienFields } from '@/types/dossier';
import { FieldCard } from './FieldCard';

interface CockpitGridProps {
  dossier: Dossier;
  onOverrideFieldStatus?: (fieldKey: string, newStatus: FieldStatus, note?: string) => void;
}

export const CockpitGrid: React.FC<CockpitGridProps> = ({ dossier, onOverrideFieldStatus }) => {
  // Notarielle Pflichtfelder (Immobilienkaufvertrag & Standard-Notariatszuarbeit)
  const fields = dossier.fields as ImmobilienFields;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {/* 1. Verkäufer */}
      <FieldCard
        index={1}
        title="Verkäufer"
        subtitle="Eingetragene Eigentümerin, Rechtsform & Vertretung"
        status={fields.verkaeufer.status}
        source={fields.verkaeufer.source}
        note={fields.verkaeufer.note}
        actionRequired={fields.verkaeufer.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('verkaeufer', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.verkaeufer.data?.name || '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              <strong className="text-foreground">Rechtsform:</strong>{' '}
              {fields.verkaeufer.data?.legalForm || '—'}
            </p>
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
      </FieldCard>

      {/* 2. Käufer */}
      <FieldCard
        index={2}
        title="Käufer"
        subtitle="Firma, Registerdaten, Vertretung & Anschrift"
        status={fields.kaeufer.status}
        source={fields.kaeufer.source}
        note={fields.kaeufer.note}
        actionRequired={fields.kaeufer.actionRequired}
        onStatusOverride={(newStatus, note) => onOverrideFieldStatus?.('kaeufer', newStatus, note)}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {cleanTextValue(fields.kaeufer.data?.companyName) || '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              <strong className="text-foreground">Rechtsform:</strong>{' '}
              {cleanTextValue(fields.kaeufer.data?.legalForm) || '—'}
            </p>
            <p>
              <strong className="text-foreground">Handelsregister:</strong>{' '}
              {(() => {
                const court = cleanTextValue(fields.kaeufer.data?.registerCourt);
                const regNum = cleanTextValue(fields.kaeufer.data?.registerNumber);
                if (court && regNum)
                  return (
                    <span className="text-foreground font-medium">{`${court}, ${regNum}`}</span>
                  );
                if (court || regNum)
                  return <span className="text-foreground font-medium">{court || regNum}</span>;
                return <span className="text-muted-foreground">—</span>;
              })()}
            </p>
            <p>
              <strong className="text-foreground">Geschäftsanschrift:</strong>{' '}
              {cleanTextValue(fields.kaeufer.data?.address) ? (
                <span className="text-foreground font-medium">
                  {cleanTextValue(fields.kaeufer.data?.address)}
                </span>
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
      </FieldCard>

      {/* 3. Grundbuch */}
      <FieldCard
        index={3}
        title="Grundbuch"
        subtitle="Amtsgericht, Grundbuch von & Blattnummer"
        status={fields.grundbuch.status}
        source={fields.grundbuch.source}
        note={fields.grundbuch.note}
        actionRequired={fields.grundbuch.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('grundbuch', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.grundbuch.data?.amtsgericht || fields.grundbuch.data?.grundbuchBezirk
                ? `Amtsgericht ${fields.grundbuch.data?.amtsgericht || '—'}, Grundbuch von ${fields.grundbuch.data?.grundbuchBezirk || '—'}`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
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
      </FieldCard>

      {/* 4. Grundstücke */}
      <FieldCard
        index={4}
        title="Grundstücke"
        subtitle="Flurstücke, Gemarkung, Flur, Größe & Wirtschaftsart"
        status={fields.grundstuecke.status}
        source={fields.grundstuecke.source}
        note={fields.grundstuecke.note}
        actionRequired={fields.grundstuecke.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('grundstuecke', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.grundstuecke.data?.parcels && fields.grundstuecke.data.parcels.length > 0
                ? `${fields.grundstuecke.data.parcels.length} Flurstück(e) erfasst`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            {fields.grundstuecke.data?.parcels?.map((p, idx) => (
              <div key={idx} className="bg-muted/50 border-border rounded-md border p-1.5 text-xs">
                <span className="text-foreground font-medium">
                  Flurstück <strong>{p.flurstueckNummer || '—'}</strong> (Flur {p.flur || '—'},{' '}
                  {p.gemarkung || '—'})
                </span>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
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
      </FieldCard>

      {/* 5. Kaufpreis */}
      <FieldCard
        index={5}
        title="Kaufpreis"
        subtitle="Betrag in Ziffern und Worten (Chronologie & Nachträge)"
        status={fields.kaufpreis.status}
        source={fields.kaufpreis.source}
        note={fields.kaufpreis.note}
        actionRequired={fields.kaufpreis.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('kaufpreis', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 shrink-0 text-[#4D9619]" />
            <span className="text-foreground text-lg font-bold">
              {fields.kaufpreis.data?.amountInFigures
                ? `${fields.kaufpreis.data.amountInFigures.toLocaleString('de-DE')} EUR`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p className="text-foreground italic">
              In Worten: <strong>{fields.kaufpreis.data?.amountInWords || '—'}</strong>
            </p>
            {fields.kaufpreis.data?.priceEvolutionSummary && (
              <div className="bg-muted/60 border-border text-foreground rounded-md border p-2.5 text-[11px]">
                <strong className="text-[#356611]">Verhandlungshistorie:</strong>{' '}
                {fields.kaufpreis.data.priceEvolutionSummary}
              </div>
            )}
          </div>
        </div>
      </FieldCard>

      {/* 6. Finanzierung */}
      <FieldCard
        index={6}
        title="Finanzierung"
        subtitle="Grundschuldbestellung, Gläubiger & Belastungsvollmacht"
        status={fields.finanzierung.status}
        source={fields.finanzierung.source}
        note={fields.finanzierung.note}
        actionRequired={fields.finanzierung.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('finanzierung', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Landmark className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.finanzierung.data?.lenderName || '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
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
      </FieldCard>

      {/* 7. Belastungen */}
      <FieldCard
        index={7}
        title="Belastungen (Abt. II & III)"
        subtitle="Übernahme, Löschung oder Ablösung bestehender Rechte"
        status={fields.belastungen.status}
        source={fields.belastungen.source}
        note={fields.belastungen.note}
        actionRequired={fields.belastungen.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('belastungen', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.belastungen.data?.entries && fields.belastungen.data.entries.length > 0
                ? `${fields.belastungen.data.entries.length} Eintragung(en) verzeichnet`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground max-h-48 space-y-1.5 overflow-y-auto pr-1 text-xs">
            {fields.belastungen.data?.entries?.map((b, idx) => (
              <div key={idx} className="bg-muted/50 border-border rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">
                    Abt. {b.section} Nr. {b.runningNumber || '—'}
                  </span>
                  <span className="bg-background border-border text-foreground rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase">
                    {b.intendedHandling}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  {b.description} {b.amount ? `(${b.amount})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FieldCard>

      {/* 8. Mietverhältnisse */}
      <FieldCard
        index={8}
        title="Mietverhältnisse"
        subtitle="Übergehende Verträge (§ 566 BGB), Miete & Flächen"
        status={fields.mietverhaeltnisse.status}
        source={fields.mietverhaeltnisse.source}
        note={fields.mietverhaeltnisse.note}
        actionRequired={fields.mietverhaeltnisse.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('mietverhaeltnisse', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Home className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              {fields.mietverhaeltnisse.data?.yearlyNetRent
                ? `${fields.mietverhaeltnisse.data.yearlyNetRent.toLocaleString('de-DE')} EUR p.a.`
                : '—'}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
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
              <p className="text-muted-foreground text-[11px]">
                {fields.mietverhaeltnisse.data.privacyOrRedactionNotes}
              </p>
            )}
            {fields.mietverhaeltnisse.data?.tenancyTransferNotes && (
              <p className="text-muted-foreground text-[11px]">
                <strong className="text-foreground">§ 566 BGB Übergang:</strong>{' '}
                {fields.mietverhaeltnisse.data.tenancyTransferNotes}
              </p>
            )}
          </div>
        </div>
      </FieldCard>

      {/* 9. Energieausweis */}
      <FieldCard
        index={9}
        title="Energieausweis"
        subtitle="Pflichtangaben nach GEG (Art, Wert, Gültigkeit)"
        status={fields.energieausweis.status}
        source={fields.energieausweis.source}
        note={fields.energieausweis.note}
        actionRequired={fields.energieausweis.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('energieausweis', newStatus, note)
        }
      >
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
          <div className="text-muted-foreground space-y-1 text-xs">
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
      </FieldCard>

      {/* 10. Übergabe */}
      <FieldCard
        index={10}
        title="Übergabe"
        subtitle="Besitzübergang, Stichtag & Fälligkeitsregelung"
        status={fields.uebergabe.status}
        source={fields.uebergabe.source}
        note={fields.uebergabe.note}
        actionRequired={fields.uebergabe.actionRequired}
        onStatusOverride={(newStatus, note) =>
          onOverrideFieldStatus?.('uebergabe', newStatus, note)
        }
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Key className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground font-semibold">
              Geplant zum: {formatDateGerman(fields.uebergabe.data?.targetDate)}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              <strong className="text-foreground">Regelung:</strong>{' '}
              {fields.uebergabe.data?.conditionDescription || '—'}
            </p>
            {fields.uebergabe.data?.riskTransferNotes && (
              <p className="text-muted-foreground text-[11px]">
                {fields.uebergabe.data.riskTransferNotes}
              </p>
            )}
          </div>
        </div>
      </FieldCard>
    </div>
  );
};
