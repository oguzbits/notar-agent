import { NextRequest } from 'next/server';
import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS } from '@/types/jobs';
import { POST, PUT } from './route';

describe('API Route: POST /api/analyze Guardrails & Validation', () => {
  it('sollte Status 400 liefern, wenn weder Dateien noch Notizen übermittelt werden', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        files: [],
        notes: '',
        caseType: CASE_TYPES.IMMOBILIENKAUF,
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

  it('sollte Status 400 liefern, wenn ungültiger caseType übermittelt wird', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        files: [{ name: 'test.pdf', type: 'application/pdf', size: 100 }],
        caseType: 'INVALID_TYPE',
      }),
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
          caseType: CASE_TYPES.IMMOBILIENKAUF,
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

  it('sollte Status 202 Accepted mit jobId liefern, wenn async=true übergeben wird', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';

    try {
      const req = new NextRequest('http://localhost:3000/api/analyze?async=true', {
        method: 'POST',
        body: JSON.stringify({
          files: [{ name: 'test.pdf', type: 'application/pdf', size: 100, content: 'data' }],
          caseType: CASE_TYPES.IMMOBILIENKAUF,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.jobId).toBeDefined();
      expect(data.status).toBe(JOB_STATUS.PENDING);
      expect(data.pollUrl).toBe(`/api/jobs/${data.jobId}`);
    } finally {
      if (prevKey) {
        process.env.GEMINI_API_KEY = prevKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});

describe('API Route: PUT /api/analyze Guardrails & Validation', () => {
  it('sollte Status 400 liefern, wenn documentId oder dossier fehlen', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('sollte Status 200 liefern, wenn documentId und valides Dossier gesendet werden', async () => {
    const validDossier = createTestImmobilienDossier();
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify({
        documentId: 'doc-test-123',
        dossier: validDossier,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
