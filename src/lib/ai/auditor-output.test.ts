import { describe, it, expect } from 'vitest';
import { OVERALL_STATUS } from '@/types/dossier';
import { parseAuditorOutput } from './auditor-output';

describe('parseAuditorOutput', () => {
  it('markiert unlesbare Ausgabe als fail-closed (ACTION_REQUIRED)', () => {
    const result = parseAuditorOutput('kein json');
    expect(result.failClosedStatus).toBe(OVERALL_STATUS.ACTION_REQUIRED);
  });

  it('markiert schemawidrige Ausgabe als fail-closed', () => {
    const result = parseAuditorOutput('{"overallStatus": 42}');
    expect(result.failClosedStatus).toBe(OVERALL_STATUS.ACTION_REQUIRED);
  });

  it('lässt gültige Ausgabe unverändert', () => {
    const result = parseAuditorOutput('{}');
    expect(result.failClosedStatus).toBeUndefined();
  });
});
