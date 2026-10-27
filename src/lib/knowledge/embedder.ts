import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany, type EmbeddingModel } from 'ai';
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
