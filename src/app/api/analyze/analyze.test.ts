import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

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
});
