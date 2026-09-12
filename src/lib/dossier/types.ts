import { FieldStatus, SourceLocation } from '@/types/dossier';

export interface SubSourceItem {
  fileName: string;
  snippet?: string;
  pageNumber?: number;
}

export interface FieldObservation {
  fieldKey: string;
  fieldTitle: string;
  fieldIndex: number;
  status: FieldStatus;
  note: string;
  actionRequired?: string;
  source?: SourceLocation;
  sources: SubSourceItem[];
}

export interface CaseTypeCoreConfig {
  partyFields: string[];
  objectFields: string[];
}
