import { z } from 'zod';

/** Ursachenarten, aus denen die Belegprüfung einen Eintrag verwirft (nur die Art, nie der Wortlaut). */
export const VERIFICATION_REASON = {
  SOURCE_MISSING: 'SOURCE_MISSING',
  DOCUMENT_UNREADABLE: 'DOCUMENT_UNREADABLE',
  SNIPPET_NOT_FOUND: 'SNIPPET_NOT_FOUND',
  NUMBER_UNSUPPORTED: 'NUMBER_UNSUPPORTED',
  PRICE_DISCREPANCY: 'PRICE_DISCREPANCY',
  CAPITAL_DISCREPANCY: 'CAPITAL_DISCREPANCY',
} as const;

export const VerificationReasonSchema = z.enum([
  VERIFICATION_REASON.SOURCE_MISSING,
  VERIFICATION_REASON.DOCUMENT_UNREADABLE,
  VERIFICATION_REASON.SNIPPET_NOT_FOUND,
  VERIFICATION_REASON.NUMBER_UNSUPPORTED,
  VERIFICATION_REASON.PRICE_DISCREPANCY,
  VERIFICATION_REASON.CAPITAL_DISCREPANCY,
]);
export type VerificationReason = z.infer<typeof VerificationReasonSchema>;

/** Zähler je Ursachenart: Schlüssel sind ausschließlich die Arten, Werte ganze Zahlen. */
export const VerificationReasonCountsSchema = z.strictObject({
  [VERIFICATION_REASON.SOURCE_MISSING]: z.number().int().nonnegative(),
  [VERIFICATION_REASON.DOCUMENT_UNREADABLE]: z.number().int().nonnegative(),
  [VERIFICATION_REASON.SNIPPET_NOT_FOUND]: z.number().int().nonnegative(),
  [VERIFICATION_REASON.NUMBER_UNSUPPORTED]: z.number().int().nonnegative(),
  [VERIFICATION_REASON.PRICE_DISCREPANCY]: z.number().int().nonnegative(),
  [VERIFICATION_REASON.CAPITAL_DISCREPANCY]: z.number().int().nonnegative(),
});
export type VerificationReasonCounts = z.infer<typeof VerificationReasonCountsSchema>;
