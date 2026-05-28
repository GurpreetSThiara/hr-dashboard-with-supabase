
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Role tier definitions
const ROLE_TIER_MAP: Record<string, number> = {
  'Super Admin': 1,
  'Owner': 2,
  'Admin': 3,
  'HR Admin': 4,
  'HR Manager': 5,
  'HR Executive': 6,
  'Recruiter': 7,
  'Payroll Manager': 8,
  'Finance': 9,
  'Compliance': 10,
  'IT Ops': 11,
  'Director': 12,
  'Manager': 13,
  'Team Lead': 14,
  'Employee': 15,
  'Contractor': 16,
  'Intern': 17,
  'Read-Only User': 18,
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Initialize from localStorage synchronously (if available)
  let initialRole = 'Employee';
  let initialTier = 15;
  let initialUser = null;

  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('hrcore_user');
    if (storedUser) {
      try {
        initialUser = JSON.parse(storedUser);
        initialRole = initialUser.role || 'Employee';
        initialTier = ROLE_TIER_MAP[initialRole] || 15;
      } catch (e) {
        // Failed to parse stored user, will fall back to Supabase
      }
    }
  }

  const [user, setUser] = useState<any>(initialUser);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(!initialUser);
  const [role, setRole] = useState<string>(initialRole);
  const [tier, setTier] = useState<number>(initialTier);
  const supabase = createClient();

  useEffect(() => {
    // If already loaded from localStorage, just set loading to false and return
    if (initialUser) {
      setLoading(false);
      return;
    }

    // Fall back to Supabase session if not in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Extract role and tier from user metadata
      if (session?.user) {
        const userRole = session.user.user_metadata?.role || 'Employee';
        setRole(userRole);
        setTier(ROLE_TIER_MAP[userRole] || 15);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Extract role and tier from user metadata
      if (session?.user) {
        const userRole = session.user.user_metadata?.role || 'Employee';
        setRole(userRole);
        setTier(ROLE_TIER_MAP[userRole] || 15);
      } else {
        setRole('Employee');
        setTier(15);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Email/Password Sign Up
  const signUp = async (email: string, password: string, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || ''
        },
        emailRedirectTo: undefined
      }
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Get Current User
  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  // Get User Profile from Database
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    session,
    loading,
    role,
    tier,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
