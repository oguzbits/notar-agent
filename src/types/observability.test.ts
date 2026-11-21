import { describe, expect, it } from 'vitest';
import { LogEventSchema } from './observability';
import { VERIFICATION_REASON, type VerificationReasonCounts } from './verification';

const counts: VerificationReasonCounts = {
  [VERIFICATION_REASON.SOURCE_MISSING]: 0,
  [VERIFICATION_REASON.DOCUMENT_UNREADABLE]: 1,
  [VERIFICATION_REASON.SNIPPET_NOT_FOUND]: 2,
  [VERIFICATION_REASON.NUMBER_UNSUPPORTED]: 0,
  [VERIFICATION_REASON.PRICE_DISCREPANCY]: 0,
  [VERIFICATION_REASON.CAPITAL_DISCREPANCY]: 0,
};

describe('LogEventSchema: verificationReasonCounts', () => {
  it('akzeptiert Zähler je Ursachenart', () => {
    const parsed = LogEventSchema.safeParse({
      level: 'info',
      event: 'verifikation_zusammenfassung',
      verificationReasonCounts: counts,
    });
    expect(parsed.success).toBe(true);
  });

  it('lehnt Freitext-Schlüssel wie Dateinamen ab', () => {
    const parsed = LogEventSchema.safeParse({
      level: 'info',
      event: 'verifikation_zusammenfassung',
      verificationReasonCounts: { ...counts, 'Kaufvertrag_Mueller.pdf': 1 },
    });
    expect(parsed.success).toBe(false);
  });

  it('lehnt Texte und negative oder gebrochene Werte als Zähler ab', () => {
    for (const bad of ['Kaufpreis 450.000 Euro', -1, 1.5]) {
      const parsed = LogEventSchema.safeParse({
        level: 'info',
        event: 'verifikation_zusammenfassung',
        verificationReasonCounts: { ...counts, [VERIFICATION_REASON.SNIPPET_NOT_FOUND]: bad },
      });
      expect(parsed.success).toBe(false);
    }
  });
});
