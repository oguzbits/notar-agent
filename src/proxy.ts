import { type NextRequest } from 'next/server';
import { REQUEST_ID_HEADER, resolveRequestId } from '@/lib/observability/request-id';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  // Auf dem Request, damit jede von updateSession erzeugte Antwort (auch in setAll) die Kennung an die Route weitergibt
  request.headers.set(REQUEST_ID_HEADER, requestId);
  const response = await updateSession(request);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
