import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany, type EmbeddingModel } from 'ai';
import { getEnv, type Env } from '@/env';
import { EMBEDDING_DIMENSIONS, EmbeddingVectorSchema } from '@/types/knowledge';
import { formatDocumentForEmbedding, formatQueryForEmbedding } from './embedding-text';

export interface IEmbedder {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(docs: { title: string; content: string }[]): Promise<number[][]>;
}

// Kein taskType: gemini-embedding-2 unterstützt ihn nicht (siehe embedding-text.ts).
const providerOptions = { google: { outputDimensionality: EMBEDDING_DIMENSIONS } };

export function createEmbedder(model: EmbeddingModel): IEmbedder {
  return {
    async embedQuery(text) {
      const { embedding } = await embed({
        model,
        value: formatQueryForEmbedding(text),
        providerOptions,
      });
      return EmbeddingVectorSchema.parse(embedding);
    },
    async embedDocuments(docs) {
      const { embeddings } = await embedMany({
        model,
        values: docs.map(formatDocumentForEmbedding),
        providerOptions,
      });
      return embeddings.map((e) => EmbeddingVectorSchema.parse(e));
    },
  };
}

export const createGeminiEmbedder = (modelId: string, apiKey: string): IEmbedder =>
  createEmbedder(createGoogleGenerativeAI({ apiKey }).embeddingModel(modelId));

/** Ohne EMBEDDING_MODEL_ID sucht die Pipeline nur im Volltext; mit Modell-ID aber ohne Schlüssel ist die Konfiguration falsch. */
export function getEmbedder(
  config: Pick<
    Env,
    'EMBEDDING_MODEL_ID' | 'GEMINI_API_KEY' | 'GOOGLE_GENERATIVE_AI_API_KEY'
  > = getEnv()
): IEmbedder | undefined {
  if (!config.EMBEDDING_MODEL_ID) return undefined;
  const apiKey = config.GEMINI_API_KEY || config.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('EMBEDDING_MODEL_ID ist gesetzt, aber GEMINI_API_KEY fehlt.');
  }
  return createGeminiEmbedder(config.EMBEDDING_MODEL_ID, apiKey);
}
