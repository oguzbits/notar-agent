import { describe, it, expect } from 'vitest';
import { STATUS_LABELS_DE } from '@/lib/dossier/constants';
import { IMMOBILIEN_EXTRACTION_AGENT_PROMPT, NOTARY_AUDITOR_RECONCILER_PROMPT } from './prompts';

describe('Prompts: Statuswörter in Freitexten', () => {
  it.each([
    ['Extraktion', IMMOBILIEN_EXTRACTION_AGENT_PROMPT],
    ['Auditor', NOTARY_AUDITOR_RECONCILER_PROMPT],
  ])('%s: verlangt die deutschen Anzeigebegriffe statt der Statusnamen', (_name, prompt) => {
    for (const label of Object.values(STATUS_LABELS_DE)) {
      expect(prompt).toContain(`„${label}“`);
    }
  });
});
