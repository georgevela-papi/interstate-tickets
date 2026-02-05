import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  let tenantSlug = 'interstate'; // Default for development

  // Production: Extract subdomain
  if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      tenantSlug = parts[0];
    }
  } else {
    // Development: Use query param if provided
    const url = new URL(request.url);
    tenantSlug = url.searchParams.get('tenant') || 'interstate';
  }

  // Validate slug (prevent SQL injection via slug)
  const validSlug = /^[a-z0-9-]+$/.test(tenantSlug);
  if (!validSlug) {
    tenantSlug = 'interstate';
  }

  // Pass tenant slug to the app via header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', tenantSlug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
