import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { TenantProvider } from '@/lib/tenant-context';
import { BrandProvider } from '@/components/BrandProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Tickets',
  description: 'Job ticket management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const tenantSlug = headersList.get('x-tenant-slug') || 'interstate';

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased">
        <TenantProvider tenantSlug={tenantSlug}>
          <BrandProvider>
            {children}
          </BrandProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
