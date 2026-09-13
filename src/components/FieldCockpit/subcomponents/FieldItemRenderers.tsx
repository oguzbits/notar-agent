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
import { cn } from '@/lib/utils';
import { ENERGIEAUSWEIS_TYPES, ImmobilienFields } from '@/types/dossier';

interface FieldItemProps {
  fields: ImmobilienFields;
  isCompact?: boolean;
}

export const VerkaeuferItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.verkaeufer.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';
  const name = cleanTextValue(data?.name);
  const legalForm = cleanTextValue(data?.legalForm);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">{name || '—'}</span>
        {!isCompact && legalForm && (
          <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs font-medium">
            {legalForm}
          </span>
        )}
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        {isCompact && (
          <p>
            <strong className="text-foreground">Rechtsform:</strong> {legalForm || '—'}
          </p>
        )}
        <div>
          <strong className="text-foreground">Eigentümerin laut Grundbuch:</strong>{' '}
          {data?.registeredOwnersGrundbuch && data.registeredOwnersGrundbuch.length > 0 ? (
            <span className="text-foreground font-medium">
              {data.registeredOwnersGrundbuch
                .map((owner: unknown) => formatOwnerEntry(owner))
                .join('; ')}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <strong className="text-foreground">Vertretungsberechtigte:</strong>{' '}
          {data?.authorizedRepresentatives && data.authorizedRepresentatives.length > 0 ? (
            <span className="text-foreground font-medium">
              {data.authorizedRepresentatives.join(', ')}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-foreground font-medium">Nachweise vorliegend:</span>{' '}
          {data?.representationProofProvided ? (
            <span className="font-semibold text-emerald-800">Vollständig</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const KaeuferItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.kaeufer.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';
  const court = cleanTextValue(data?.registerCourt);
  const regNum = cleanTextValue(data?.registerNumber);
  const address = cleanTextValue(data?.address);
  const legalForm = cleanTextValue(data?.legalForm);
  const companyName = cleanTextValue(data?.companyName);
  const hrDisplay = court && regNum ? `${court}, ${regNum}` : court || regNum || null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <UserCheck className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">{companyName || '—'}</span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
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
          {data?.hasOfficialRegisterProof ? (
            <span className="font-semibold text-emerald-800">Amtlicher HR-Auszug liegt vor</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
      </div>
    </div>
  );
};

export const GrundbuchItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.grundbuch.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">
          {data?.amtsgericht || data?.grundbuchBezirk
            ? `Amtsgericht ${data?.amtsgericht || '—'}, Grundbuch von ${data?.grundbuchBezirk || '—'}`
            : '—'}
        </span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        <p>
          <strong className="text-foreground">Blattnummer:</strong>{' '}
          <span className="text-foreground font-medium">{data?.blatt || '—'}</span>
        </p>
        <p>
          <strong className="text-foreground">Stand des Auszugs:</strong>{' '}
          {data?.standDatum ? (
            <span className="text-foreground font-medium">{formatDateGerman(data.standDatum)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
      </div>
    </div>
  );
};

export const GrundstueckeItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.grundstuecke.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">
          {data?.parcels && data.parcels.length > 0
            ? `${data.parcels.length} Flurstück(e) erfasst`
            : '—'}
        </span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        {data?.parcels?.map((p, idx) => (
          <div key={idx} className="bg-muted/50 border-border rounded-md border p-2">
            <span className="text-foreground font-medium">
              Flurstück <strong>{p.flurstueckNummer || '—'}</strong> (Flur {p.flur || '—'},{' '}
              {p.gemarkung || '—'})
            </span>
            <div className="text-muted-foreground mt-0.5 text-xs">
              Fläche: {p.sizeM2 ? `${p.sizeM2} m²` : 'unbekannt'} |{' '}
              {p.wirtschaftsart || 'Wirtschaftsart nicht angegeben'}
            </div>
          </div>
        ))}
        {Boolean(data?.totalAreaM2 && data.totalAreaM2 > 0) && (
          <p className="text-foreground pt-1 font-semibold">Gesamtfläche: {data!.totalAreaM2} m²</p>
        )}
      </div>
    </div>
  );
};

export const KaufpreisItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.kaufpreis.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Coins className="text-notar-800 h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-bold">
          {data?.amountInFigures ? `${data.amountInFigures.toLocaleString('de-DE')} EUR` : '—'}
        </span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        <p className="text-foreground italic">
          In Worten: <strong>{data?.amountInWords || '—'}</strong>
        </p>
        {data?.priceEvolutionSummary && (
          <div className="bg-muted/60 border-border text-foreground rounded-md border p-2.5 text-xs leading-relaxed sm:text-sm">
            <strong className="text-notar-900">Verhandlungshistorie:</strong>{' '}
            {data.priceEvolutionSummary}
          </div>
        )}
      </div>
    </div>
  );
};

export const FinanzierungItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.finanzierung.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Landmark className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="text-foreground font-semibold">{data?.lenderName || '—'}</span>
      </div>
      <div className={cn('text-muted-foreground space-y-1', textSize)}>
        <p>
          <strong className="text-foreground">Grundschuldbetrag:</strong>{' '}
          {data?.mortgageAmount ? (
            <span className="text-foreground font-medium">
              {`${data.mortgageAmount.toLocaleString('de-DE')} EUR`}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
        <p>
          <strong className="text-foreground">Finanzierungsvollmacht im Vertrag:</strong>{' '}
          {data?.requiresFinancingPowerOfAttorney ? (
            <span className="font-semibold text-emerald-800">Ja (Standardklausel)</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
      </div>
    </div>
  );
};

export const BelastungenItemContent: React.FC<FieldItemProps> = ({ fields }) => {
  const data = fields.belastungen.data;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">
          {data?.entries && data.entries.length > 0
            ? `${data.entries.length} Eintragung(en) verzeichnet`
            : '—'}
        </span>
      </div>
      <div className="text-muted-foreground max-h-56 space-y-2 overflow-y-auto pr-1 text-sm">
        {data?.entries?.map((b, idx) => (
          <div key={idx} className="bg-muted/50 border-border rounded-md border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-sm font-semibold sm:text-base">
                Abt. {b.section} Nr. {b.runningNumber || '—'}
              </span>
              <span className="bg-background border-border text-foreground rounded border px-2 py-0.5 font-mono text-xs uppercase">
                {b.intendedHandling}
              </span>
            </div>
            <div className="text-muted-foreground mt-1 text-xs sm:text-sm">
              {b.description} {b.amount ? `(${b.amount})` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MietverhaeltnisseItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.mietverhaeltnisse.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Home className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">
          {data?.yearlyNetRent ? `${data.yearlyNetRent.toLocaleString('de-DE')} EUR p.a.` : '—'}
        </span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        <p>
          <strong className="text-foreground">Vollvermietung:</strong>{' '}
          {data?.fullRentedStatus ? 'Laut Angabe ja' : '—'}
        </p>
        <p>
          <strong className="text-foreground">Fläche:</strong>{' '}
          {data?.rentableAreaM2 ? `${data.rentableAreaM2} m²` : '—'} |{' '}
          <strong className="text-foreground">Einheiten:</strong> {data?.unitCount || '—'}
        </p>
        {data?.privacyOrRedactionNotes && (
          <p className="text-muted-foreground text-xs sm:text-sm">{data.privacyOrRedactionNotes}</p>
        )}
        {data?.tenancyTransferNotes && (
          <p className="text-muted-foreground text-xs sm:text-sm">
            <strong className="text-foreground">§ 566 BGB Übergang:</strong>{' '}
            {data.tenancyTransferNotes}
          </p>
        )}
      </div>
    </div>
  );
};

export const EnergieausweisItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.energieausweis.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="h-4.5 w-4.5 shrink-0 text-amber-600" />
        <span className="text-foreground text-base font-semibold">
          {data?.certificateType && data.certificateType !== ENERGIEAUSWEIS_TYPES.UNBEKANNT
            ? data.certificateType
            : '—'}{' '}
          {data?.efficiencyClass ? `(Klasse ${data.efficiencyClass})` : ''}
        </span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        <p>
          <strong className="text-foreground">Endenergiewert:</strong>{' '}
          {data?.energyValueKWh ? `${data.energyValueKWh} kWh/(m²*a)` : '—'}
        </p>
        <p>
          <strong className="text-foreground">Gültig bis:</strong>{' '}
          {formatDateGerman(data?.validUntil)}{' '}
          {data?.isExpired && <span className="font-semibold text-rose-700">(ABGELAUFEN)</span>}
        </p>
        <p>
          <strong className="text-foreground">Energieträger:</strong>{' '}
          {data?.primaryEnergyCarrier || '—'} |{' '}
          <strong className="text-foreground">Baujahr:</strong> {data?.buildingYear || '—'}
        </p>
      </div>
    </div>
  );
};

export const UebergabeItemContent: React.FC<FieldItemProps> = ({ fields, isCompact }) => {
  const data = fields.uebergabe.data;
  const textSize = isCompact ? 'text-sm' : 'text-base';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Key className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
        <span className="text-foreground text-base font-semibold">
          Geplant zum: {formatDateGerman(data?.targetDate)}
        </span>
      </div>
      <div className={cn('text-muted-foreground space-y-1.5', textSize)}>
        <p>
          <strong className="text-foreground">Regelung:</strong> {data?.conditionDescription || '—'}
        </p>
        {data?.riskTransferNotes && (
          <p className="text-muted-foreground text-xs sm:text-sm">{data.riskTransferNotes}</p>
        )}
      </div>
    </div>
  );
};
