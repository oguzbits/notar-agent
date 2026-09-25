import { JudgeVerdict } from '@/types/eval';

export interface JudgeEvaluateParams {
  fieldKey: string;
  expected: unknown;
  actual: unknown;
  criteria?: string;
}

export interface IEvalJudge {
  evaluate(params: JudgeEvaluateParams): Promise<JudgeVerdict>;
}
