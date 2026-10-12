import { describe, it, expect } from 'vitest';
import { OVERALL_STATUS } from '@/types/dossier';
import { cleanAndParseJson } from './clean-json';

describe('cleanAndParseJson Utility', () => {
  it('parst sauberes JSON problemlos', () => {
    const input = '{"caseTitle": "Test", "count": 42}';
    const result = cleanAndParseJson<{ caseTitle: string; count: number }>(input);
    expect(result).toEqual({ caseTitle: 'Test', count: 42 });
  });

  it('entfernt Markdown-Fences mit ```json Präfix', () => {
    const input = `\`\`\`json\n{"status": "${OVERALL_STATUS.READY}"}\n\`\`\``;
    const result = cleanAndParseJson<{ status: string }>(input);
    expect(result).toEqual({ status: OVERALL_STATUS.READY });
  });

  it('entfernt Markdown-Fences ohne Sprachbezeichner', () => {
    const input = `\`\`\`\n{"status": "${OVERALL_STATUS.ACTION_REQUIRED}"}\n\`\`\``;
    const result = cleanAndParseJson<{ status: string }>(input);
    expect(result).toEqual({ status: OVERALL_STATUS.ACTION_REQUIRED });
  });

  it('ignoriert umgebende Whitespaces und Zeilenumbrüche', () => {
    const input = '  \n\n  {"ok": true}  \n  ';
    const result = cleanAndParseJson<{ ok: boolean }>(input);
    expect(result).toEqual({ ok: true });
  });

  it('wirft einen verständlichen Fehler bei ungültigem JSON', () => {
    const input = 'Kein JSON hier';
    expect(() => cleanAndParseJson(input)).toThrow(/Ungültiges JSON/);
  });

  it('wirft einen Fehler bei leerer Eingabe', () => {
    expect(() => cleanAndParseJson('')).toThrow(/Ungültiges JSON/);
  });

  it('entfernt <thought>-Blöcke vor dem JSON selbst wenn sie geschweifte Klammern enthalten', () => {
    const input = `
<thought>
Hier ist mein Zwischengedanke mit internen Daten: {"temp": 123, "eval": false}.
Ich formuliere jetzt das Notariat-Dossier.
</thought>
\`\`\`json
{"caseTitle": "Vorgang Schmidt", "count": 10}
\`\`\`
    `;
    const result = cleanAndParseJson<{ caseTitle: string; count: number }>(input);
    expect(result).toEqual({ caseTitle: 'Vorgang Schmidt', count: 10 });
  });

  it('entfernt <thinking>-Blöcke mit Attributen', () => {
    const input = `
<thinking type="deep-reasoning" step="1">
Prüfe Grundbuchauszug und Belastungen...
</thinking>
{"status": "${OVERALL_STATUS.READY}"}
    `;
    const result = cleanAndParseJson<{ status: string }>(input);
    expect(result).toEqual({ status: OVERALL_STATUS.READY });
  });

  it('entfernt versehentlich geleakte <thought>-Tags innerhalb von String-Feldern', () => {
    const input = JSON.stringify({
      caseTitle: 'Vorgang Schmidt',
      note: 'Rechtsgeschäft vollständig. <thought>Interner Denkprozess des Modells</thought> Übergabe vereinbart.',
    });
    const result = cleanAndParseJson<{ caseTitle: string; note: string }>(input);
    expect(result.note).toBe('Rechtsgeschäft vollständig. Übergabe vereinbart.');
  });
});
