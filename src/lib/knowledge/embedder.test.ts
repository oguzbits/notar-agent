import { MockEmbeddingModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '@/types/knowledge';
import { createEmbedder, getEmbedder } from './embedder';

const vector = (seed: number, length = EMBEDDING_DIMENSIONS) => Array.from({ length }, () => seed);

const modelReturning = (build: (values: string[]) => number[][]) =>
  new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: 2,
    doEmbed: async ({ values }) => ({
      embeddings: build(values),
      usage: { tokens: 1 },
      warnings: [],
    }),
  });

describe('createEmbedder', () => {
  it('bettet die Anfrage mit Präfix und Dimension ein', async () => {
    const model = modelReturning(() => [vector(0.5)]);
    const result = await createEmbedder(model).embedQuery(' Grundbuch ');
    expect(result).toEqual(vector(0.5));
    const [call] = model.doEmbedCalls;
    expect(call?.values).toEqual(['task: search result | query: Grundbuch']);
    expect(call?.providerOptions).toEqual({
      google: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
  });

  it('bettet Dokumente mit Präfix ein und behält die Reihenfolge über mehrere Aufrufe', async () => {
    const model = modelReturning((values) => values.map((v) => vector(Number(v.slice(-1)))));
    const docs = ['1', '2', '3', '4', '5'].map((n) => ({ title: 't', content: `c${n}` }));
    const result = await createEmbedder(model).embedDocuments(docs);
    expect(result.map((v) => v[0])).toEqual([1, 2, 3, 4, 5]);
    expect(model.doEmbedCalls.length).toBe(3);
    expect(model.doEmbedCalls[0]?.values[0]).toBe('title: t | text: c1');
  });

  it('wirft bei einem Vektor falscher Länge', async () => {
    const model = modelReturning(() => [vector(0.5, EMBEDDING_DIMENSIONS - 1)]);
    await expect(createEmbedder(model).embedQuery('x')).rejects.toThrow();
  });

  it('reicht Fehler des Modells weiter', async () => {
    const model = new MockEmbeddingModelV4({
      doEmbed: async () => {
        throw new Error('Dienst nicht erreichbar');
      },
    });
    await expect(createEmbedder(model).embedQuery('x')).rejects.toThrow('Dienst nicht erreichbar');
  });
});

describe('getEmbedder', () => {
  it('liefert ohne Modell-ID keinen Einbetter (nur Volltext)', () => {
    expect(getEmbedder({})).toBeUndefined();
  });
  it('wirft, wenn eine Modell-ID ohne Schlüssel gesetzt ist', () => {
    expect(() => getEmbedder({ EMBEDDING_MODEL_ID: 'gemini-embedding-2' })).toThrow(
      /GEMINI_API_KEY/
    );
  });
  it('liefert mit Modell-ID und Schlüssel einen Einbetter', () => {
    const embedder = getEmbedder({ EMBEDDING_MODEL_ID: 'm', GOOGLE_GENERATIVE_AI_API_KEY: 'k' });
    expect(typeof embedder?.embedQuery).toBe('function');
  });
});
