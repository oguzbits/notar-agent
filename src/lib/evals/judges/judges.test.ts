import { describe, it, expect } from 'vitest';
import { JUDGE_VERDICT_STATUS } from '@/types/eval';
import { DeterministicJudge } from './deterministic-judge';
import { JevJudge } from './jev-judge';

describe('Eval Judges (Layer 3 Outcome Judges)', () => {
  describe('DeterministicJudge', () => {
    const judge = new DeterministicJudge();

    it('matches identical strings ignoring whitespace and casing', async () => {
      const verdict = await judge.evaluate({
        fieldKey: 'kaeufer',
        expected: 'Jan Schmidt',
        actual: '  jan schmidt  ',
      });

      expect(verdict.status).toBe(JUDGE_VERDICT_STATUS.PASS);
      expect(verdict.score).toBe(1.0);
      expect(verdict.matched).toBe(true);
    });

    it('matches numbers formatted differently', async () => {
      const verdict = await judge.evaluate({
        fieldKey: 'kaufpreis',
        expected: 550000,
        actual: 550000,
      });

      expect(verdict.status).toBe(JUDGE_VERDICT_STATUS.PASS);
      expect(verdict.score).toBe(1.0);
    });

    it('fails on distinct strings', async () => {
      const verdict = await judge.evaluate({
        fieldKey: 'kaeufer',
        expected: 'Jan Schmidt',
        actual: 'Erika Musterfrau',
      });

      expect(verdict.status).toBe(JUDGE_VERDICT_STATUS.FAIL);
      expect(verdict.score).toBe(0.0);
      expect(verdict.matched).toBe(false);
    });
  });

  describe('JevJudge (System-1 Decision Adapter)', () => {
    it('falls back gracefully to deterministic judgment when no JEV_API_KEY is configured', async () => {
      const judge = new JevJudge({ apiKey: undefined });

      const verdict = await judge.evaluate({
        fieldKey: 'verkaeufer',
        expected: 'Maria Fischer',
        actual: 'Maria Fischer',
      });

      expect(verdict.status).toBe(JUDGE_VERDICT_STATUS.PASS);
      expect(verdict.matched).toBe(true);
      expect(verdict.reason).toContain('Deterministischer Fallback');
    });

    it('parses simulated Jev response schema correctly into JudgeVerdict', () => {
      const mockJevClient = {
        decide: async () => ({
          choice: JUDGE_VERDICT_STATUS.PASS,
          score: 0.98,
          confidence: 0.94,
          reason: 'Semantische Übereinstimmung mit Vertretungsverhältnis',
        }),
      };

      const judge = new JevJudge({
        apiKey: 'test-jev-key',
        client: mockJevClient,
      });

      return judge
        .evaluate({
          fieldKey: 'verkaeufer',
          expected: 'Dr. Maria Fischer (GF)',
          actual: 'Maria Fischer, handelnd als Geschäftsführerin',
        })
        .then((verdict) => {
          expect(verdict.status).toBe(JUDGE_VERDICT_STATUS.PASS);
          expect(verdict.score).toBe(0.98);
          expect(verdict.confidence).toBe(0.94);
        });
    });
  });
});
