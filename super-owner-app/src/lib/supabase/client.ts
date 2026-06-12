import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // During build/prerender env vars may be absent — return a no-op proxy.
    return new Proxy({} as any, {
      get(_t, prop) {
        if (prop === 'auth') {
          return new Proxy({} as any, {
            get(_a, authProp) {
              if (authProp === 'onAuthStateChange') {
                return () => ({ data: { subscription: { unsubscribe: () => {} } } });
              }
              if (authProp === 'getSession') return async () => ({ data: { session: null } });
              return () => {};
            },
          });
        }
        return () =>
          new Proxy({} as any, { get: () => () => Promise.resolve({ data: null, error: null }) });
      },
    });
  }

  return createBrowserClient(url, anonKey);
}
