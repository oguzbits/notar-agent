/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { parseDocxDocument } from './docx-document-parser';

describe('docx-document-parser with mammoth', () => {
  it('handles empty or corrupt docx buffer gracefully without throwing unhandled error', async () => {
    const corruptBuffer = Buffer.from('not a real docx zip');
    const result = await parseDocxDocument(corruptBuffer);

    expect(result.markdown).toBe('');
    expect(result.characterCount).toBe(0);
  });
});
