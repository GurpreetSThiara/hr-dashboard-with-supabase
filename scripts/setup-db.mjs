import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const postgresUrl = process.env.POSTGRES_URL;

async function setupDatabase() {
  const sqlPath = path.join(__dirname, 'setup-database.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ setup-database.sql not found at:', sqlPath);
    process.exit(1);
  }
  const setupSQL = fs.readFileSync(sqlPath, 'utf8');

  // Try Postgres connection first if POSTGRES_URL is available
  if (postgresUrl) {
    console.log('🚀 Connecting to database via POSTGRES_URL...');
    const client = new pg.Client({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('✅ Connected to database. Running migrations...');
      await client.query(setupSQL);
      console.log('✅ Database schema setup complete via PostgreSQL!');
      await client.end();
      return;
    } catch (err) {
      console.error('❌ Failed setup via POSTGRES_URL:', err.message);
      if (!supabaseUrl || !serviceRoleKey) {
        process.exit(1);
      }
      console.log('🔄 Falling back to Supabase API...');
    }
  }

  // Fallback to Supabase RPC
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Missing credentials. Please provide POSTGRES_URL or both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  console.log('🚀 Connecting to Supabase API...');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('🚀 Running database schema via RPC...');
    const { error } = await supabase.rpc('exec_sql', { sql: setupSQL });

    if (error) {
      console.error('❌ RPC exec_sql failed:', error.message);
      console.log('\n💡 Tip: If you are using a new Supabase project, you must run the SQL in scripts/setup-database.sql manually via the Supabase Dashboard SQL Editor once to create tables and setup RLS policies.');
      process.exit(1);
    }

    console.log('✅ Database schema setup complete via Supabase RPC!');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
