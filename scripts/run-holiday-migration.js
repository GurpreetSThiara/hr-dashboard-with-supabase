const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected');

  const sql = fs.readFileSync('/tmp/holiday-schema.sql', 'utf8');
  
  // Execute statements
  try {
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch(err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
