// @ts-ignore
import pg from 'pg';

export async function withPgClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not configured. Add it to your .env file.');
  }

  const PgClient = pg.default?.Client || pg.Client;
  const client = new PgClient({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Tenant-scoped DB access for multi-tenant routes.
 *
 * Sets `app.current_org` on the session before running `fn`, so:
 *   1. The (Phase 4) RLS backstop policies — `organization_id =
 *      current_setting('app.current_org')::uuid` — can enforce isolation even
 *      if an app-layer filter is missed.
 *   2. Query code can derive the org from `current_setting('app.current_org')`.
 *
 * App code must STILL add explicit `WHERE organization_id = $org` filters: the
 * primary connection runs as superuser (RLS does not apply until the Phase 4
 * non-superuser role lands). This wrapper is the mandatory entry point for all
 * tenant data access — it guarantees the org id is server-derived, never
 * client-supplied.
 *
 * `organizationId` MUST come from the server-resolved actor. Pass null only for
 * a verified Super Owner doing an explicit cross-tenant operation.
 */
export async function withTenantPgClient<T>(
  organizationId: string | null,
  fn: (client: any, organizationId: string | null) => Promise<T>
): Promise<T> {
  if (organizationId !== null && !/^[0-9a-f-]{36}$/i.test(organizationId)) {
    throw new Error('withTenantPgClient: invalid organizationId');
  }
  return withPgClient(async (client) => {
    // set_config(..., true) = transaction/session-local; survives for this conn.
    await client.query('SELECT set_config($1, $2, false)', [
      'app.current_org',
      organizationId ?? '',
    ]);
    return fn(client, organizationId);
  });
}
