import { z } from 'zod';
import { CaseTypeSchema } from './dossier';
import { KnowledgeReviewStatusSchema } from './knowledge';
import { DbUuidSchema } from './primitives';

export const PruefplanSchema = z.object({
  caseType: CaseTypeSchema,
  fields: z.array(z.object({ fieldKey: z.string(), title: z.string() })),
  rules: z.array(
    z.object({
      id: DbUuidSchema,
      title: z.string(),
      legalBasis: z.string(),
      reviewStatus: KnowledgeReviewStatusSchema,
    })
  ),
  ruleBasisReviewed: z.boolean(),
});
export type Pruefplan = z.infer<typeof PruefplanSchema>;
