import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // During Next.js static prerendering / build, environment variables might not be present.
    // Return a dummy client proxy to prevent build-time crashes.
    return new Proxy({} as any, {
      get(target, prop) {
        if (prop === 'auth') {
          return new Proxy({} as any, {
            get(authTarget, authProp) {
              if (authProp === 'onAuthStateChange') {
                return () => ({ data: { subscription: { unsubscribe: () => {} } } });
              }
              if (authProp === 'getSession') {
                return async () => ({ data: { session: null } });
              }
              return () => {};
            }
          });
        }
        return () => new Proxy({} as any, {
          get() {
            return () => Promise.resolve({ data: null, error: null });
          }
        });
      }
    });
  }

  return createBrowserClient(url, anonKey);
}
