'use client';

import Image from 'next/image';
import { useTenant } from '@/lib/tenant-context';

interface BrandLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function BrandLogo({ width = 120, height = 80, className = '' }: BrandLogoProps) {
  const { tenant, loading } = useTenant();

  if (loading) {
    return (
      <div
        className={`bg-gray-200 animate-pulse rounded ${className}`}
        style={{ width, height }}
      />
    );
  }

  const logoUrl = tenant?.logo_url || 'https://interstatetire.online/logo.png';
  const altText = tenant?.name || 'Job Tickets';

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <Image
        src={logoUrl}
        alt={altText}
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
