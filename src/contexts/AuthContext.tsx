'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  tier: number;
  department: string | null;
  /** Tenant the user belongs to. null = platform-level Super Owner. */
  organization_id: string | null;
  /** Derived: true for the global Super Owner (belongs to no organization). */
  is_super_owner: boolean;
}

export interface TenantContext {
  organizationId: string | null;
  isSuperOwner: boolean;
  status: string | null;
  maintenanceMode: boolean;
  active: boolean;
  plan: { code: string | null; name: string | null };
  modules: string[];
  seat: { used: number; limit: number | null; remaining: number | null };
  subscription: { endsAt: string | null; expired: boolean };
  branding: { name: string | null; primaryColor: string | null; logoUrl: string | null };
  announcements: Array<{ id: string; title: string; body: string | null; level: string }>;
  featureFlags: string[];
  platform: { supportEmail: string | null };
}

interface AuthContextValue {
  user: any | null;
  profile: UserProfile | null;
  session: any | null;
  loading: boolean;
  role: string;
  tier: number;
  customPermissions: Record<string, number[]> | null;
  /** Full effective permission keys (tier grants + permission-set grants). */
  effectivePermissions: string[] | null;
  /** Module codes enabled by the org's plan. null = not loaded / don't gate. */
  enabledModules: string[] | null;
  /** Unified Super-Owner-controlled tenant context (status, seats, banners…). */
  tenantContext: TenantContext | null;
  /** True for the platform Super Owner (tier 0, no organization). */
  isSuperOwner: boolean;
  refreshPermissions: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/** F29: whether a Super-Owner-controlled global feature flag is enabled. */
export const useFeatureFlag = (key: string): boolean => {
  const { tenantContext } = useAuth();
  return !!tenantContext?.featureFlags?.includes(key);
};

/** Convenience: whether the org's plan enables a module (Super Owner = all). */
export const useHasModule = (code: string): boolean => {
  const { tenantContext, isSuperOwner } = useAuth();
  if (isSuperOwner) return true;
  if (!tenantContext) return true; // not loaded yet → don't hide
  return tenantContext.modules.includes(code);
};

const ROLE_TIER_MAP: Record<string, number> = {
  'Super Owner': 0,
  'Super Admin': 1, 'Owner': 2, 'Admin': 3, 'HR Admin': 4, 'HR Manager': 5,
  'HR Executive': 6, 'Recruiter': 7, 'Payroll Manager': 8, 'Finance': 9,
  'Compliance': 10, 'IT Ops': 11, 'Director': 12, 'Manager': 13,
  'Team Lead': 14, 'Employee': 15, 'Contractor': 16, 'Intern': 17, 'Read-Only User': 18,
};

const LS_USER_KEY = 'hrcore_user';

function clearLegacyLocalStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('hrcore_user');
  localStorage.removeItem('hrcore_token');
  localStorage.removeItem('hrcore_refresh');
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = createClient();

  // Initialize from localStorage cache (fast path before Supabase responds)
  let initialProfile: UserProfile | null = null;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LS_USER_KEY);
    if (stored) {
      try { initialProfile = JSON.parse(stored); } catch {}
    }
  }

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customPermissions, setCustomPermissions] = useState<Record<string, number[]> | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<string[] | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);

  // Helper: derive role + tier from profile / metadata / fallback
  const role = profile?.role || user?.user_metadata?.role || 'Employee';
  const tier = profile?.tier ?? user?.user_metadata?.tier ?? ROLE_TIER_MAP[role] ?? 15;

  // ── Profile loader ─────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string, userEmail?: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, tier, department, organization_id')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      // Fallback to a minimal profile so the app still works for users that
      // haven't been added to the public.users table yet
      return {
        id: userId,
        email: userEmail || '',
        full_name: null,
        role: 'Employee',
        tier: 15,
        department: null,
        organization_id: null,
        is_super_owner: false,
      };
    }
    return {
      ...(data as any),
      organization_id: (data as any).organization_id ?? null,
      is_super_owner: (data as any).role === 'Super Owner',
    } as UserProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    const p = await fetchProfile(user.id, user.email);
    setProfile(p);
    if (typeof window !== 'undefined' && p) {
      localStorage.setItem(LS_USER_KEY, JSON.stringify(p));
    }
  }, [user?.id, user?.email, fetchProfile]);

  // ── Permission matrix loader ───────────────────────────────────────────────
  const loadPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/role-permissions');
      if (res.ok) {
        const data = await res.json();
        setCustomPermissions(data.isDefault ? null : data.matrix);
      }
    } catch {
      // Non-fatal — runtime falls back to hardcoded permissions
    }
    // Effective permissions = tier grants merged with permission-set grants.
    // This is authoritative on the server too, so UI and API stay consistent.
    try {
      const eff = await fetch('/api/me/effective-permissions');
      if (eff.ok) {
        const d = await eff.json();
        setEffectivePermissions(Array.isArray(d.permissions) ? d.permissions : null);
      }
    } catch {
      // Non-fatal — falls back to tier matrix
    }
    // Unified tenant context: effective modules (plan ± overrides), org status,
    // maintenance, seat usage, subscription expiry, announcements, branding.
    // This keeps the HR app in sync with the Super Owner app.
    try {
      const ctxRes = await fetch('/api/me/context');
      if (ctxRes.ok) {
        const ctx = await ctxRes.json();
        setTenantContext(ctx);
        setEnabledModules(Array.isArray(ctx.modules) ? ctx.modules : null);
      }
    } catch {
      // Non-fatal — null means "don't gate by module" (fail open to permission checks)
    }
  }, []);

  // ── Initial session + auth state listener ──────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function bootstrap(currentSession: any) {
      if (!mounted) return;
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const p = await fetchProfile(currentUser.id, currentUser.email);
        if (mounted) {
          setProfile(p);
          if (typeof window !== 'undefined' && p) {
            localStorage.setItem(LS_USER_KEY, JSON.stringify(p));
          }
        }
      } else {
        setProfile(null);
        clearLegacyLocalStorage();
      }
      if (mounted) setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      bootstrap(session);
      loadPermissions();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      bootstrap(session);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadPermissions();
      }
      if (event === 'SIGNED_OUT') {
        clearLegacyLocalStorage();
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [fetchProfile, loadPermissions]);

  // ── Auth methods ───────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Profile + permissions will be loaded by onAuthStateChange
    return data;
  };

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata.fullName || '',
          avatar_url: metadata.avatarUrl || '',
        },
        emailRedirectTo: undefined,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch {}
    clearLegacyLocalStorage();
    setUser(null);
    setProfile(null);
    setSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/sign-up-login-screen';
    }
  };

  const value: AuthContextValue = {
    user,
    profile,
    session,
    loading,
    role,
    tier,
    customPermissions,
    effectivePermissions,
    enabledModules,
    tenantContext,
    isSuperOwner: role === 'Super Owner',
    refreshPermissions: loadPermissions,
    refreshProfile,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
