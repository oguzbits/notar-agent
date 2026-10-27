import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS, EmbeddingVectorSchema } from '@/types/knowledge';
import { formatDocumentForEmbedding, formatQueryForEmbedding } from './embedding-text';

describe('formatQueryForEmbedding', () => {
  it('setzt das Anfrage-Präfix und trimmt', () => {
    expect(formatQueryForEmbedding('  Grundbuch Notiz \n')).toBe(
      'task: search result | query: Grundbuch Notiz'
    );
  });
  it('wirft bei leerem Text', () => {
    expect(() => formatQueryForEmbedding('   ')).toThrow();
  });
});

describe('formatDocumentForEmbedding', () => {
  it('setzt das Dokument-Präfix aus Titel und Inhalt und trimmt', () => {
    expect(formatDocumentForEmbedding({ title: ' Titel ', content: ' Inhalt\n' })).toBe(
      'title: Titel | text: Inhalt'
    );
  });
  it('wirft bei leerem Titel oder Inhalt', () => {
    expect(() => formatDocumentForEmbedding({ title: ' ', content: 'x' })).toThrow();
    expect(() => formatDocumentForEmbedding({ title: 'x', content: '' })).toThrow();
  });
});

describe('EmbeddingVectorSchema', () => {
  const vector = (length: number, value = 0.1) => Array.from({ length }, () => value);
  it('nimmt genau die vorgesehene Länge an', () => {
    expect(EmbeddingVectorSchema.safeParse(vector(EMBEDDING_DIMENSIONS)).success).toBe(true);
  });
  it('lehnt falsche Längen ab', () => {
    expect(EmbeddingVectorSchema.safeParse(vector(EMBEDDING_DIMENSIONS - 1)).success).toBe(false);
    expect(EmbeddingVectorSchema.safeParse(vector(EMBEDDING_DIMENSIONS + 1)).success).toBe(false);
  });
  it('lehnt nicht endliche Zahlen ab', () => {
    expect(EmbeddingVectorSchema.safeParse(vector(EMBEDDING_DIMENSIONS, NaN)).success).toBe(false);
    expect(EmbeddingVectorSchema.safeParse(vector(EMBEDDING_DIMENSIONS, Infinity)).success).toBe(
      false
    );
  });
});
