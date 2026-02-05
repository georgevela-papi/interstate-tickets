'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { ReactNode } from 'react';

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
