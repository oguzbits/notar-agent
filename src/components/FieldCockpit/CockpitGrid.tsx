import React from 'react';
import { Dossier, FieldStatus, isImmobilienDossier } from '@/types/dossier';
import { FieldCard } from './FieldCard';
import {
  VerkaeuferItemContent,
  KaeuferItemContent,
  GrundbuchItemContent,
  GrundstueckeItemContent,
  KaufpreisItemContent,
  FinanzierungItemContent,
  BelastungenItemContent,
  MietverhaeltnisseItemContent,
  EnergieausweisItemContent,
  UebergabeItemContent,
} from './subcomponents/FieldItemRenderers';

interface CockpitGridProps {
  dossier: Dossier;
  onOverrideFieldStatus?: (fieldKey: string, newStatus: FieldStatus, note?: string) => void;
}

export const CockpitGrid: React.FC<CockpitGridProps> = ({ dossier, onOverrideFieldStatus }) => {
  if (!isImmobilienDossier(dossier)) {
    return null;
  }

  const { fields } = dossier;

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
        <VerkaeuferItemContent fields={fields} isCompact={true} />
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
        <KaeuferItemContent fields={fields} isCompact={true} />
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
        <GrundbuchItemContent fields={fields} isCompact={true} />
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
        <GrundstueckeItemContent fields={fields} isCompact={true} />
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
        <KaufpreisItemContent fields={fields} isCompact={true} />
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
        <FinanzierungItemContent fields={fields} isCompact={true} />
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
        <BelastungenItemContent fields={fields} isCompact={true} />
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
        <MietverhaeltnisseItemContent fields={fields} isCompact={true} />
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
        <EnergieausweisItemContent fields={fields} isCompact={true} />
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
        <UebergabeItemContent fields={fields} isCompact={true} />
      </FieldCard>
    </div>
  );
};
