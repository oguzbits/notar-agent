import { NextRequest } from 'next/server';
import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('API Route: POST /api/analyze Guardrails & Validation', () => {
  it('sollte Status 400 liefern, wenn weder Dateien noch Notizen übermittelt werden', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        files: [],
        notes: '',
        caseType: 'IMMOBILIENKAUF',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('Keine Dokumente oder Notizen');
  });

  it('sollte Status 400 liefern, wenn ein leeres Body-Objekt gesendet wird', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('sollte Status 500 liefern, wenn kein API-Key hinterlegt ist', async () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevAnthropic = process.env.ANTHROPIC_API_KEY;
    const prevGoogleGen = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    try {
      const req = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          files: [{ name: 'test.pdf', type: 'application/pdf', size: 100, content: 'data' }],
          caseType: 'IMMOBILIENKAUF',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Kein KI-API-Key konfiguriert');
    } finally {
      if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
      if (prevAnthropic) process.env.ANTHROPIC_API_KEY = prevAnthropic;
      if (prevGoogleGen) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevGoogleGen;
    }
  });
});
