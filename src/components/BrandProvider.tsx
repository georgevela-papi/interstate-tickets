'use client';

import { ReactNode, useEffect } from 'react';
import { useTenant } from '@/lib/tenant-context';

interface BrandProviderProps {
  children: ReactNode;
}

/**
 * BrandProvider applies tenant-specific CSS variables for dynamic theming.
 *
 * CSS Variables set:
 * --brand-primary: Primary brand color (buttons, links, headers)
 * --brand-secondary: Secondary brand color (hover states, accents)
 */
export function BrandProvider({ children }: BrandProviderProps) {
  const { tenant } = useTenant();

  useEffect(() => {
    if (tenant) {
      // Apply tenant branding as CSS variables
      document.documentElement.style.setProperty('--brand-primary', tenant.primary_color);
      document.documentElement.style.setProperty('--brand-secondary', tenant.secondary_color);
    } else {
      // Default to Interstate colors
      document.documentElement.style.setProperty('--brand-primary', '#0EA5E9');
      document.documentElement.style.setProperty('--brand-secondary', '#0284C7');
    }
  }, [tenant]);

  return <>{children}</>;
}
