import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  // Get tenant slug from middleware header
  const tenantSlug = request.headers.get('x-tenant-slug') || 'interstate';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: tenant } = await supabase
    .from('tenants_public')
    .select('name, primary_color, logo_url')
    .eq('slug', tenantSlug)
    .single();

  const manifest = {
    name: tenant?.name ? `${tenant.name} - Job Tickets` : 'Job Tickets',
    short_name: tenant?.name || 'Tickets',
    description: 'Internal job ticket management system',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    background_color: tenant?.primary_color || '#6B7280',
    theme_color: tenant?.primary_color || '#6B7280',
    orientation: 'portrait',
    icons: tenant?.logo_url
      ? [
          { src: tenant.logo_url, sizes: '192x192', type: 'image/png' },
          { src: tenant.logo_url, sizes: '512x512', type: 'image/png' },
        ]
      : [
          { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
        ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
