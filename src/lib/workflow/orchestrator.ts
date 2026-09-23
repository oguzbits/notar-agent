import { calculateNextStep, validateStepTransition } from '@/lib/workflow/engine';
import { IWorkflowRepository } from '@/lib/workflow/repository';
import {
  WORKFLOW_ACTORS,
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_STEP_STATUS,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStepDefinition,
} from '@/types/workflow';

export type StepExecutionHandler = (
  step: WorkflowStepDefinition,
  instance: WorkflowInstance,
  contextData: Record<string, unknown>
) => Promise<Record<string, unknown>>;

export interface ExecuteWorkflowParams {
  workflowDefinition: WorkflowDefinition;
  workflowInstance: WorkflowInstance;
  repository: IWorkflowRepository;
  stepRunner: StepExecutionHandler;
  contextData?: Record<string, unknown>;
  actorRole?: string;
}

/**
 * Führt automatische Workflow-Schritte sequentiell aus und stoppt sauber an Human-in-the-Loop Gates.
 */
export async function executeWorkflowInstance(
  params: ExecuteWorkflowParams
): Promise<WorkflowInstance> {
  const { workflowDefinition, repository, stepRunner, actorRole = WORKFLOW_ACTORS.AGENT } = params;

  let currentInstance = params.workflowInstance;
  const context = { ...(params.contextData || {}) };

  while (currentInstance.status !== WORKFLOW_INSTANCE_STATUS.COMPLETED) {
    const nextStep = calculateNextStep(workflowDefinition, currentInstance, context);

    if (!nextStep) {
      currentInstance.status = WORKFLOW_INSTANCE_STATUS.COMPLETED;
      break;
    }

    // Rollenvalidierung: Kann der aktuelle Akteur diesen Schritt ausführen?
    const transitionCheck = validateStepTransition(nextStep, actorRole);
    if (!transitionCheck.allowed) {
      // Wenn z.B. Notarfreigabe erforderlich ist und der Agent läuft -> Anhalten!
      break;
    }

    try {
      // Schritt ausführen
      const stepResult = await stepRunner(nextStep, currentInstance, context);

      // Kontext mit den Ergebnissen des Schritts anreichern
      Object.assign(context, stepResult);

      // Zustand im Repository persistieren
      currentInstance = await repository.updateStepState({
        instanceId: currentInstance.id,
        stepId: nextStep.id,
        status: WORKFLOW_STEP_STATUS.COMPLETED,
        executedBy: actorRole,
        metadata: stepResult,
        contextData: context,
      });
    } catch (stepErr: unknown) {
      const errorMsg =
        stepErr instanceof Error ? stepErr.message : 'Schrittausführung fehlgeschlagen';
      currentInstance = await repository.updateStepState({
        instanceId: currentInstance.id,
        stepId: nextStep.id,
        status: WORKFLOW_STEP_STATUS.FAILED,
        executedBy: actorRole,
        metadata: { error: errorMsg },
        contextData: context,
      });
      throw stepErr;
    }
  }

  return currentInstance;
}
