'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

interface Profile {
  id: string;
  tenant_id: string;
  staff_id: string;
  role: 'SERVICE_WRITER' | 'TECHNICIAN' | 'MANAGER';
}

interface TenantContextValue {
  tenant: Tenant | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  profile: null,
  loading: true,
  error: null,
  isAuthenticated: false,
});

interface TenantProviderProps {
  children: ReactNode;
  tenantSlug: string;
}

export function TenantProvider({ children, tenantSlug }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // 1. Load tenant by slug using PUBLIC VIEW (no auth required)
        // Uses tenants_public view which only exposes branding fields
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants_public')
          .select('id, slug, name, logo_url, primary_color, secondary_color')
          .eq('slug', tenantSlug)
          .single();

        if (tenantError || !tenantData) {
          if (mounted) {
            setError('Business not found');
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setTenant(tenantData);
        }

        // 2. Check auth session
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Not authenticated - this is OK for login page
          if (mounted) {
            setIsAuthenticated(false);
            setLoading(false);
          }
          return;
        }

        // 3. Load profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profileData) {
          // Authenticated but no profile = not on allowlist
          await supabase.auth.signOut();
          if (mounted) {
            setError('Your account is not authorized. Contact your administrator.');
            setLoading(false);
          }
          return;
        }

        // 4. CRITICAL: Verify tenant match
        if (profileData.tenant_id !== tenantData.id) {
          await supabase.auth.signOut();
          if (mounted) {
            setError('You do not have access to this business.');
            setLoading(false);
          }
          return;
        }

        // 5. Success
        if (mounted) {
          setProfile(profileData);
          setIsAuthenticated(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('TenantProvider error:', err);
        if (mounted) {
          setError('Failed to load business configuration');
          setLoading(false);
        }
      }
    }

    initialize();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setIsAuthenticated(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Re-run initialization
          initialize();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [tenantSlug]);

  return (
    <TenantContext.Provider value={{ tenant, profile, loading, error, isAuthenticated }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
