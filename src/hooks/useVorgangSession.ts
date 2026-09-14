'use client';

import { useReducer } from 'react';
import {
  Dossier,
  CaseType,
  CASE_TYPES,
  UploadedFilePayload,
  PersistenceMeta,
  STORAGE_TYPES,
} from '@/types/dossier';

export interface VorgangSessionState {
  files: UploadedFilePayload[];
  caseType: CaseType;
  notes: string;
  dossier: Dossier | null;
  activeDocumentId: string | null;
  isAppending: boolean;
  appendFiles: UploadedFilePayload[];
  appendNotes: string;
  persistenceInfo: PersistenceMeta | null;
}

export type VorgangSessionAction =
  | { type: 'SET_FILES'; payload: UploadedFilePayload[] }
  | { type: 'SET_CASE_TYPE'; payload: CaseType }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_DOSSIER'; payload: Dossier | null }
  | { type: 'SET_ACTIVE_DOCUMENT_ID'; payload: string | null }
  | { type: 'SET_IS_APPENDING'; payload: boolean }
  | { type: 'SET_APPEND_FILES'; payload: UploadedFilePayload[] }
  | { type: 'SET_APPEND_NOTES'; payload: string }
  | { type: 'SET_PERSISTENCE_INFO'; payload: PersistenceMeta | null }
  | { type: 'RESET_APPEND' }
  | { type: 'RESET_NEW_VORGANG' }
  | { type: 'SELECT_DOCUMENT'; payload: { docId: string; dossier: Dossier; title: string } };

const initialState: VorgangSessionState = {
  files: [],
  caseType: CASE_TYPES.IMMOBILIENKAUF,
  notes: '',
  dossier: null,
  activeDocumentId: null,
  isAppending: false,
  appendFiles: [],
  appendNotes: '',
  persistenceInfo: null,
};

function vorgangSessionReducer(
  state: VorgangSessionState,
  action: VorgangSessionAction
): VorgangSessionState {
  switch (action.type) {
    case 'SET_FILES':
      return { ...state, files: action.payload };
    case 'SET_CASE_TYPE':
      return { ...state, caseType: action.payload };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'SET_DOSSIER':
      return { ...state, dossier: action.payload };
    case 'SET_ACTIVE_DOCUMENT_ID':
      return { ...state, activeDocumentId: action.payload };
    case 'SET_IS_APPENDING':
      return { ...state, isAppending: action.payload };
    case 'SET_APPEND_FILES':
      return { ...state, appendFiles: action.payload };
    case 'SET_APPEND_NOTES':
      return { ...state, appendNotes: action.payload };
    case 'SET_PERSISTENCE_INFO':
      return { ...state, persistenceInfo: action.payload };
    case 'RESET_APPEND':
      return {
        ...state,
        isAppending: false,
        appendFiles: [],
        appendNotes: '',
      };
    case 'RESET_NEW_VORGANG':
      return {
        ...state,
        dossier: null,
        activeDocumentId: null,
        files: [],
        notes: '',
        isAppending: false,
        appendFiles: [],
        appendNotes: '',
        persistenceInfo: null,
      };
    case 'SELECT_DOCUMENT':
      return {
        ...state,
        dossier: action.payload.dossier,
        activeDocumentId: action.payload.docId,
        files: [],
        notes: '',
        isAppending: false,
        appendFiles: [],
        appendNotes: '',
        persistenceInfo: {
          storageType: STORAGE_TYPES.SUPABASE,
          caseNumber: action.payload.title,
        },
      };
    default:
      return state;
  }
}

export function useVorgangSession() {
  const [state, dispatch] = useReducer(vorgangSessionReducer, initialState);

  const actions = {
    setFiles: (files: UploadedFilePayload[]) => dispatch({ type: 'SET_FILES', payload: files }),
    setCaseType: (caseType: CaseType) => dispatch({ type: 'SET_CASE_TYPE', payload: caseType }),
    setNotes: (notes: string) => dispatch({ type: 'SET_NOTES', payload: notes }),
    setDossier: (dossier: Dossier | null) => dispatch({ type: 'SET_DOSSIER', payload: dossier }),
    setActiveDocumentId: (id: string | null) =>
      dispatch({ type: 'SET_ACTIVE_DOCUMENT_ID', payload: id }),
    setIsAppending: (isAppending: boolean) =>
      dispatch({ type: 'SET_IS_APPENDING', payload: isAppending }),
    setAppendFiles: (files: UploadedFilePayload[]) =>
      dispatch({ type: 'SET_APPEND_FILES', payload: files }),
    setAppendNotes: (notes: string) => dispatch({ type: 'SET_APPEND_NOTES', payload: notes }),
    setPersistenceInfo: (info: PersistenceMeta | null) =>
      dispatch({ type: 'SET_PERSISTENCE_INFO', payload: info }),
    resetAppend: () => dispatch({ type: 'RESET_APPEND' }),
    resetNewVorgang: () => dispatch({ type: 'RESET_NEW_VORGANG' }),
    selectDocument: (docId: string, dossier: Dossier, title: string) =>
      dispatch({ type: 'SELECT_DOCUMENT', payload: { docId, dossier, title } }),
  };

  return { state, dispatch, actions };
}
