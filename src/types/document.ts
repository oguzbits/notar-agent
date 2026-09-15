import { z } from 'zod';
import { DossierSchema } from './dossier';

export const CASE_STATUS = {
  IN_PROGRESS: 'In Prüfung',
  DRAFT_READY: 'Entwurfsreif',
} as const;

export const CaseStatusSchema = z.enum([CASE_STATUS.IN_PROGRESS, CASE_STATUS.DRAFT_READY]);

export type CaseStatus = (typeof CASE_STATUS)[keyof typeof CASE_STATUS];

export const DocumentRecordSchema = z.object({
  id: z.string().min(1, 'ID darf nicht leer sein'),
  organizationId: z
    .string()
    .uuid()
    .optional()
    .describe('Kanzlei-ID für RLS Mandantentrennung gem. § 203 StGB'),
  title: z.string(),
  status: CaseStatusSchema,
  content: DossierSchema,
  created_at: z.string(),
});

export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;
