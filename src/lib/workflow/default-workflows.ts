import { CASE_TYPES } from '@/types/dossier';
import {
  WORKFLOW_ACTORS,
  WORKFLOW_STEP_TYPES,
  STEP_CONDITION_OPERATORS,
  WorkflowDefinition,
} from '@/types/workflow';

/**
 * Standard-Workflow-Definition für Immobilienkaufverträge (§ 311b BGB, § 17 BeurkG).
 */
export const DEFAULT_IMMOBILIENKAUF_WORKFLOW: WorkflowDefinition = {
  id: 'wf_def_immobilienkauf_standard',
  version: 1,
  caseType: CASE_TYPES.IMMOBILIENKAUF,
  title: 'Standardablauf Immobilienkaufvertrag (§ 311b BGB)',
  createdAt: '2026-09-24T00:00:00.000Z',
  steps: [
    {
      id: 'step_ingestion_extraction',
      title: 'Urkunden- & Sachverhaltserfassung',
      type: WORKFLOW_STEP_TYPES.EXTRACTION,
      actor: WORKFLOW_ACTORS.AGENT,
      action: 'extract_documents',
      isOptional: false,
      description:
        'Multimodale Erfassung von Grundbuchauszug, Verträgen und Ausweisen mit Belegnachweisen.',
    },
    {
      id: 'step_guardrails',
      title: 'Deterministische Notar-Guardrails',
      type: WORKFLOW_STEP_TYPES.GUARDRAILS,
      actor: WORKFLOW_ACTORS.SYSTEM,
      action: 'apply_guardrails',
      isOptional: false,
      description:
        'Prüfung von Fristen (10 Jahre GEG), Arithmetik (Parzellenflächen, Mieten) und Identitäten.',
    },
    {
      id: 'step_gwg_gate',
      title: 'Geldwäsche-Sonderprüfung (GWG)',
      type: WORKFLOW_STEP_TYPES.CONDITIONAL_GATE,
      actor: WORKFLOW_ACTORS.AGENT,
      action: 'verify_gwg_threshold',
      condition: {
        field: 'kaufpreis',
        operator: STEP_CONDITION_OPERATORS.GREATER_THAN,
        value: 1000000,
      },
      isOptional: false,
      description: 'Automatische Sonderprüfung bei Transaktionsvolumen über 1.000.000 €.',
    },
    {
      id: 'step_notary_auditor',
      title: 'Notarielle Vorprüfung, Fristen & Plausibilisierung',
      type: WORKFLOW_STEP_TYPES.AUDITOR,
      actor: WORKFLOW_ACTORS.AGENT,
      action: 'audit_dossier',
      isOptional: false,
      description: 'JIT-Regelprüfung gegen Kanzlei-Knowledge und Erstellung von Nachforderungen.',
    },
    {
      id: 'step_human_approval',
      title: 'Notarfreigabe & Entwurfsabnahme',
      type: WORKFLOW_STEP_TYPES.HUMAN_APPROVAL,
      actor: WORKFLOW_ACTORS.NOTAR,
      action: 'approve_dossier',
      isOptional: false,
      description:
        'Rechtsverbindliche Abschlussfreigabe durch Notar oder Sachbearbeitung (§ 17 BeurkG).',
    },
  ],
};

/**
 * Standard-Workflow-Definition für GmbH-Gründungen (§ 2 GmbHG).
 */
export const DEFAULT_GMBH_GRUENDUNG_WORKFLOW: WorkflowDefinition = {
  id: 'wf_def_gmbh_gruendung_standard',
  version: 1,
  caseType: CASE_TYPES.GMBH_GRUENDUNG,
  title: 'Standardablauf GmbH-Gründung (§ 2 GmbHG)',
  createdAt: '2026-09-24T00:00:00.000Z',
  steps: [
    {
      id: 'step_ingestion_extraction',
      title: 'Erfassung der Gründungsunterlagen',
      type: WORKFLOW_STEP_TYPES.EXTRACTION,
      actor: WORKFLOW_ACTORS.AGENT,
      action: 'extract_documents',
      isOptional: false,
      description: 'Extraktion von Gesellschafterdaten, Stammkapital und Unternehmensgegenstand.',
    },
    {
      id: 'step_guardrails',
      title: 'Stammkapital- & Satzungs-Guardrails',
      type: WORKFLOW_STEP_TYPES.GUARDRAILS,
      actor: WORKFLOW_ACTORS.SYSTEM,
      action: 'apply_guardrails',
      isOptional: false,
      description:
        'Validierung des Mindeststammkapitals (25.000 € gem. § 5 GmbHG) und Bareinlagen.',
    },
    {
      id: 'step_notary_auditor',
      title: 'Notarielle Satzungsprüfung',
      type: WORKFLOW_STEP_TYPES.AUDITOR,
      actor: WORKFLOW_ACTORS.AGENT,
      action: 'audit_dossier',
      isOptional: false,
      description:
        'Prüfung auf genehmigungsbedürftige Gegenstände (§ 34c GewO etc.) und Vertretungsregeln.',
    },
    {
      id: 'step_human_approval',
      title: 'Notarfreigabe Gründungsurkunde',
      type: WORKFLOW_STEP_TYPES.HUMAN_APPROVAL,
      actor: WORKFLOW_ACTORS.NOTAR,
      action: 'approve_dossier',
      isOptional: false,
      description: 'Abschlussprüfung durch den Notar vor Beurkundungstermin.',
    },
  ],
};

export const DEFAULT_WORKFLOWS_BY_CASE_TYPE = {
  [CASE_TYPES.IMMOBILIENKAUF]: DEFAULT_IMMOBILIENKAUF_WORKFLOW,
  [CASE_TYPES.GMBH_GRUENDUNG]: DEFAULT_GMBH_GRUENDUNG_WORKFLOW,
} as const;
