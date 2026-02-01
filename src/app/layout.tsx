import type { Metadata } from 'next';
import './globals.css';

// Using system font stack for offline builds
// Google Fonts will be loaded via CSS for production

export const metadata: Metadata = {
  title: 'Interstate Tires - Job Tickets',
  description: 'Internal job ticket management system',
  manifest: '/manifest.json',
  themeColor: '#38B6FF',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Interstate Tickets',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
