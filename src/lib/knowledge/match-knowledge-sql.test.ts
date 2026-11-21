import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Statische Prüfung der Wissens-Migration (das Verhalten gegen echtes Postgres deckt
 * src/test/db/knowledge-embedding.db.test.ts ab, läuft aber nur mit lokaler Supabase).
 */
describe('match_knowledge_documents (Migration)', () => {
  const sql = readFileSync('supabase/migrations/20260916000000_knowledge_and_vector.sql', 'utf8');
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION match_knowledge_documents');
  const body = sql.slice(start, sql.indexOf('$$;', start));
  const vectorBranch = body.slice(body.indexOf('vector_ranked AS'), body.indexOf('text_ranked AS'));

  it('hat die Spalte embedding_model, auch für bereits bestehende Tabellen', () => {
    expect(sql).toMatch(/embedding_model TEXT,/);
    expect(sql).toMatch(
      /ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS embedding_model TEXT;/
    );
  });

  it('nimmt die Modellkennung als Parameter und wertet Vektoren nur mit gleicher Kennung', () => {
    expect(body).toMatch(/p_embedding_model TEXT DEFAULT NULL/);
    expect(vectorBranch).toMatch(/kd\.embedding_model = p_embedding_model/);
  });

  it('entfernt die alte Signatur (keine Überladung) und vergibt Rechte für die neue', () => {
    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS match_knowledge_documents\(TEXT, vector, UUID, knowledge_category, INT, FLOAT, FLOAT, INT\);/
    );
    const signature =
      'match_knowledge_documents(TEXT, vector, UUID, knowledge_category, INT, FLOAT, FLOAT, INT, TEXT)';
    expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon;`);
    expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`);
  });
});
