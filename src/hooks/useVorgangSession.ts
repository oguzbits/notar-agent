'use client';

import { useReducer } from 'react';
import { PreparedFile } from '@/components/UploadZone';
import { Dossier, CaseType } from '@/types/dossier';

export interface PersistenceInfo {
  storageType: 'supabase' | 'in-memory' | 'none' | 'local-only';
  caseNumber: string;
}

export interface VorgangSessionState {
  files: PreparedFile[];
  caseType: CaseType;
  notes: string;
  dossier: Dossier | null;
  activeDocumentId: string | null;
  isAppending: boolean;
  appendFiles: PreparedFile[];
  appendNotes: string;
  persistenceInfo: PersistenceInfo | null;
}

export type VorgangSessionAction =
  | { type: 'SET_FILES'; payload: PreparedFile[] }
  | { type: 'SET_CASE_TYPE'; payload: CaseType }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_DOSSIER'; payload: Dossier | null }
  | { type: 'SET_ACTIVE_DOCUMENT_ID'; payload: string | null }
  | { type: 'SET_IS_APPENDING'; payload: boolean }
  | { type: 'SET_APPEND_FILES'; payload: PreparedFile[] }
  | { type: 'SET_APPEND_NOTES'; payload: string }
  | { type: 'SET_PERSISTENCE_INFO'; payload: PersistenceInfo | null }
  | { type: 'RESET_APPEND' }
  | { type: 'RESET_NEW_VORGANG' }
  | { type: 'SELECT_DOCUMENT'; payload: { docId: string; dossier: Dossier; title: string } };

const initialState: VorgangSessionState = {
  files: [],
  caseType: 'IMMOBILIENKAUF',
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
          storageType: 'supabase',
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
    setFiles: (files: PreparedFile[]) => dispatch({ type: 'SET_FILES', payload: files }),
    setCaseType: (caseType: CaseType) => dispatch({ type: 'SET_CASE_TYPE', payload: caseType }),
    setNotes: (notes: string) => dispatch({ type: 'SET_NOTES', payload: notes }),
    setDossier: (dossier: Dossier | null) => dispatch({ type: 'SET_DOSSIER', payload: dossier }),
    setActiveDocumentId: (id: string | null) =>
      dispatch({ type: 'SET_ACTIVE_DOCUMENT_ID', payload: id }),
    setIsAppending: (isAppending: boolean) =>
      dispatch({ type: 'SET_IS_APPENDING', payload: isAppending }),
    setAppendFiles: (files: PreparedFile[]) =>
      dispatch({ type: 'SET_APPEND_FILES', payload: files }),
    setAppendNotes: (notes: string) => dispatch({ type: 'SET_APPEND_NOTES', payload: notes }),
    setPersistenceInfo: (info: PersistenceInfo | null) =>
      dispatch({ type: 'SET_PERSISTENCE_INFO', payload: info }),
    resetAppend: () => dispatch({ type: 'RESET_APPEND' }),
    resetNewVorgang: () => dispatch({ type: 'RESET_NEW_VORGANG' }),
    selectDocument: (docId: string, dossier: Dossier, title: string) =>
      dispatch({ type: 'SELECT_DOCUMENT', payload: { docId, dossier, title } }),
  };

  return { state, dispatch, actions };
}
