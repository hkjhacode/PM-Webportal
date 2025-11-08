import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireRoles } from '@/lib/auth';

/**
 * /api/ai
 * Traceability: FR-15, FR-16 — AI chatbot queries and auto-suggestions.
 * Stubbed for MVP; integrates with Gemini via GEMINI_API_KEY when configured.
 */

export const runtime = 'nodejs';

export async function GET() {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  return NextResponse.json({ status: 'ok', provider: 'gemini', configured: hasKey });
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin', 'PMO/CEONITI', 'State Advisor', 'Div YP', 'State Div HOD'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const query: string | undefined = body?.query;
  const context = body?.context ?? {};

  if (!query) {
    return NextResponse.json({ error: 'Missing "query" in body' }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    // Not configured yet — return deterministic stub so UI can proceed.
    return NextResponse.json({
      result: `AI not configured. Stub answer for: ${query}`,
      context,
      provider: 'gemini',
      configured: false,
    }, { status: 501 });
  }

  // TODO: Integrate Gemini API call here (free-tier), cache responses.
  // For now, return a placeholder success to unblock UI.
  return NextResponse.json({
    result: `Stubbed AI response for: ${query}`,
    provider: 'gemini',
    configured: true,
  });
}

