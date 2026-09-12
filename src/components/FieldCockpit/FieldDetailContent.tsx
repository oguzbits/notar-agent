import React from 'react';
import { Dossier, ImmobilienFields } from '@/types/dossier';
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

interface FieldDetailContentProps {
  fieldKey: string;
  dossier: Dossier;
}

export const FieldDetailContent: React.FC<FieldDetailContentProps> = ({ fieldKey, dossier }) => {
  const fields = dossier.fields as ImmobilienFields;

  switch (fieldKey) {
    case 'verkaeufer':
      return <VerkaeuferItemContent fields={fields} isCompact={false} />;
    case 'kaeufer':
      return <KaeuferItemContent fields={fields} isCompact={false} />;
    case 'grundbuch':
      return <GrundbuchItemContent fields={fields} isCompact={false} />;
    case 'grundstuecke':
      return <GrundstueckeItemContent fields={fields} isCompact={false} />;
    case 'kaufpreis':
      return <KaufpreisItemContent fields={fields} isCompact={false} />;
    case 'finanzierung':
      return <FinanzierungItemContent fields={fields} isCompact={false} />;
    case 'belastungen':
      return <BelastungenItemContent fields={fields} isCompact={false} />;
    case 'mietverhaeltnisse':
      return <MietverhaeltnisseItemContent fields={fields} isCompact={false} />;
    case 'energieausweis':
      return <EnergieausweisItemContent fields={fields} isCompact={false} />;
    case 'uebergabe':
      return <UebergabeItemContent fields={fields} isCompact={false} />;
    default:
      return null;
  }
};
