import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    console.error('❌ Missing POSTGRES_URL in environment');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, 'create-attendance-settings.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🚀 Running migration scripts/create-attendance-settings.sql...');
  
  const client = new pg.Client({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
