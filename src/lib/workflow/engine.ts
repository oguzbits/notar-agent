import {
  WORKFLOW_ACTORS,
  WORKFLOW_STEP_STATUS,
  WORKFLOW_STEP_TYPES,
  STEP_CONDITION_OPERATORS,
  WorkflowActor,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStepCondition,
  WorkflowStepDefinition,
} from '@/types/workflow';

/**
 * Deterministische, sichere Auswertung von Workflow-Bedingungen ohne eval().
 */
export function evaluateStepCondition(
  condition: WorkflowStepCondition,
  contextData: Record<string, unknown>
): boolean {
  const actualValue = contextData[condition.field];

  switch (condition.operator) {
    case STEP_CONDITION_OPERATORS.EXISTS:
      return actualValue !== undefined && actualValue !== null && actualValue !== '';

    case STEP_CONDITION_OPERATORS.NOT_EXISTS:
      return actualValue === undefined || actualValue === null || actualValue === '';

    case STEP_CONDITION_OPERATORS.EQUALS:
      return actualValue === condition.value;

    case STEP_CONDITION_OPERATORS.NOT_EQUALS:
      return actualValue !== condition.value;

    case STEP_CONDITION_OPERATORS.GREATER_THAN:
      if (typeof actualValue === 'number' && typeof condition.value === 'number') {
        return actualValue > condition.value;
      }
      return false;

    case STEP_CONDITION_OPERATORS.LESS_THAN:
      if (typeof actualValue === 'number' && typeof condition.value === 'number') {
        return actualValue < condition.value;
      }
      return false;

    case STEP_CONDITION_OPERATORS.CONTAINS:
      if (typeof actualValue === 'string' && typeof condition.value === 'string') {
        return actualValue.includes(condition.value);
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(condition.value);
      }
      return false;

    default:
      return false;
  }
}

/**
 * Berechnet den nächsten ausstehenden Schritt im Workflow-Graphen.
 * Überspringt Schritte, deren Bedingung nicht erfüllt ist.
 */
export function calculateNextStep(
  definition: WorkflowDefinition,
  instance: WorkflowInstance,
  contextData: Record<string, unknown> = {}
): WorkflowStepDefinition | null {
  const steps = definition.steps;
  if (!steps || steps.length === 0) return null;

  for (const step of steps) {
    const state = instance.stepStates[step.id];

    // Falls Schritt schon erfolgreich abgeschlossen oder übersprungen -> weiter
    if (
      state &&
      (state.status === WORKFLOW_STEP_STATUS.COMPLETED ||
        state.status === WORKFLOW_STEP_STATUS.SKIPPED)
    ) {
      continue;
    }

    // Wenn Schritt eine Bedingung hat: prüfen ob erfüllt
    if (step.condition) {
      const conditionMet = evaluateStepCondition(step.condition, contextData);
      if (!conditionMet) {
        // Bedingung nicht erfüllt -> Schritt wird übersprungen
        continue;
      }
    }

    // Erster noch nicht abgeschlossener & erfüllter Schritt
    return step;
  }

  return null;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validiert die Rollen- und Rechteinteilung beim Übergang eines Schrittes.
 * Verhindert z. B., dass KI-Agenten eigenständig Notarfreigaben (§ 17 BeurkG) erteilen.
 */
export function validateStepTransition(
  step: WorkflowStepDefinition,
  actorRole: WorkflowActor | string
): TransitionValidationResult {
  if (step.type === WORKFLOW_STEP_TYPES.HUMAN_APPROVAL) {
    if (actorRole === WORKFLOW_ACTORS.AGENT) {
      return {
        allowed: false,
        reason:
          'Notarielle Freigaben erfordern zwingend menschliche Autorisierung (Notar oder Sachbearbeitung).',
      };
    }
  }

  return {
    allowed: true,
  };
}
