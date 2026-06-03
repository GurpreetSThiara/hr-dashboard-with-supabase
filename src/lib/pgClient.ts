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
