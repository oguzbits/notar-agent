import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { SupabaseKnowledgeRepository } from '@/lib/knowledge/supabase-knowledge-repository';
import { DB_TABLES } from '@/types/database';
import { EMBEDDING_DIMENSIONS, KNOWLEDGE_CATEGORIES } from '@/types/knowledge';
import { createDbHarness, type DbHarness } from './db-harness';

const vector = (value: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);

describe('Schreibpfad für Dokumentvektoren', () => {
  let harness: DbHarness;
  let repo: SupabaseKnowledgeRepository;
  const ids = { open: randomUUID(), filled: randomUUID() };

  const storedEmbedding = async (id: string) => {
    const { data, error } = await harness.admin
      .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
      .select('embedding')
      .eq('id', id)
      .single();
    expect(error).toBeNull();
    return data?.embedding ?? null;
  };

  beforeAll(async () => {
    harness = createDbHarness();
    repo = new SupabaseKnowledgeRepository(harness.admin);
    const base = {
      category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
      legal_basis: 'Testgrundlage',
      content: 'Inhalt',
    };
    const inserted = await harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).insert([
      { ...base, id: ids.open, title: 'ohne Vektor' },
      { ...base, id: ids.filled, title: 'mit Vektor', embedding: JSON.stringify(vector(0.5)) },
    ]);
    expect(inserted.error).toBeNull();
  });

  it('listet nur Dokumente ohne Vektor, mit all alle', async () => {
    const open = (await repo.listForEmbedding({ all: false })).map((d) => d.id);
    expect(open).toContain(ids.open);
    expect(open).not.toContain(ids.filled);
    const all = (await repo.listForEmbedding({ all: true })).map((d) => d.id);
    expect(all).toEqual(expect.arrayContaining([ids.open, ids.filled]));
  });

  it('speichert einen Vektor, danach fehlt das Dokument in der Liste', async () => {
    await repo.saveEmbedding(ids.open, vector(0.25));
    expect(await storedEmbedding(ids.open)).not.toBeNull();
    const open = (await repo.listForEmbedding({ all: false })).map((d) => d.id);
    expect(open).not.toContain(ids.open);
  });

  it('lehnt einen Vektor falscher Länge ab, bevor geschrieben wird', async () => {
    await expect(repo.saveEmbedding(ids.filled, vector(0.1).slice(1))).rejects.toThrow();
    expect(await storedEmbedding(ids.filled)).toBe(JSON.stringify(vector(0.5)));
  });

  it('wirft bei unbekannter ID', async () => {
    await expect(repo.saveEmbedding(randomUUID(), vector(0.1))).rejects.toThrow(/Dokument/);
  });
});
