import { IWorkflowRepository } from '@/lib/workflow/repository';
import {
  WORKFLOW_STEP_STATUS,
  WORKFLOW_STEP_TYPES,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStepDefinition,
} from '@/types/workflow';

/**
 * Speichert Ablauf-Definition und -Instanz eines Vorgangs und markiert die Schritte
 * Extraktion und Prüfung nach erfolgreicher Analyse als abgeschlossen.
 */
export async function syncAnalysisWorkflow(
  repo: IWorkflowRepository,
  params: { workflow: WorkflowDefinition; caseId: string; organizationId: string }
): Promise<WorkflowInstance> {
  const { workflow, caseId, organizationId } = params;
  await repo.saveDefinition(workflow, organizationId);
  let instance =
    (await repo.getInstanceByCaseId(caseId)) ??
    (await repo.createInstance({ workflowDefinitionId: workflow.id, caseId, organizationId }));

  const completedSteps: Array<WorkflowStepDefinition | undefined> = [
    workflow.steps[0],
    workflow.steps.find((s) => s.type === WORKFLOW_STEP_TYPES.AUDITOR),
  ];
  for (const step of completedSteps) {
    if (!step) continue;
    instance = await repo.updateStepState({
      instanceId: instance.id,
      stepId: step.id,
      status: WORKFLOW_STEP_STATUS.COMPLETED,
      executedBy: step.actor,
      metadata: { completedAt: new Date().toISOString() },
    });
  }
  return instance;
}
