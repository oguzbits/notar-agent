import { describe, it, expect } from 'vitest';
import { calculateDynamicWeights } from './dynamic-weights';

describe('Dynamic Retrieval Weights (src/lib/knowledge/dynamic-weights.ts)', () => {
  it('assigns high textWeight (0.85) when exact statutory paragraph (§) is present', () => {
    const query = '§ 80 Abs. 2 GEG Energieausweis 10 Jahre';
    const weights = calculateDynamicWeights(query);

    expect(weights.textWeight).toBe(0.85);
    expect(weights.vectorWeight).toBe(0.15);
    expect(weights.rationale).toContain('Paragraf');
  });

  it('assigns high textWeight (0.85) when commercial register (HRB) number is present', () => {
    const query = 'HRB 189234 Amtsgericht Hamburg Geschäftsführer';
    const weights = calculateDynamicWeights(query);

    expect(weights.textWeight).toBe(0.85);
    expect(weights.vectorWeight).toBe(0.15);
    expect(weights.rationale).toContain('Register');
  });

  it('assigns high textWeight (0.85) when cadastral parcel/flur is present', () => {
    const query = 'Flurstück 104/12 Flur 3 Verschmelzung';
    const weights = calculateDynamicWeights(query);

    expect(weights.textWeight).toBe(0.85);
    expect(weights.vectorWeight).toBe(0.15);
    expect(weights.rationale).toContain('Flurstück');
  });

  it('assigns high textWeight (0.85) when exact financial sum with euro is present', () => {
    const query = '12.500 Euro Stammkapital Bareinzahlung';
    const weights = calculateDynamicWeights(query);

    expect(weights.textWeight).toBe(0.85);
    expect(weights.vectorWeight).toBe(0.15);
  });

  it('assigns high vectorWeight (0.75) for abstract semantic legal questions', () => {
    const query = 'Was passiert mit bestehenden Mietverträgen beim Verkauf einer Immobilie?';
    const weights = calculateDynamicWeights(query);

    expect(weights.vectorWeight).toBe(0.75);
    expect(weights.textWeight).toBe(0.25);
    expect(weights.rationale).toContain('semantisch');
  });

  it('assigns high vectorWeight (0.75) for another conceptual question without citations', () => {
    const query = 'Darf ein älterer Grundbuchauszug verwendet werden und was muss der Notar tun?';
    const weights = calculateDynamicWeights(query);

    expect(weights.vectorWeight).toBe(0.75);
    expect(weights.textWeight).toBe(0.25);
  });

  it('defaults to balanced weights (0.5 / 0.5) for short mixed queries', () => {
    const query = 'Kaufvertrag Immobilie Eigentum';
    const weights = calculateDynamicWeights(query);

    expect(weights.textWeight).toBe(0.5);
    expect(weights.vectorWeight).toBe(0.5);
  });
});
