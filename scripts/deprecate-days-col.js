const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  await client.query(`COMMENT ON COLUMN leave_requests.days IS 'DEPRECATED: kept for backward-compat; always equals days_count. Will be removed in next major migration.'`);
  const r = await client.query(`SELECT COUNT(*) FROM leave_balance_view`);
  console.log('leave_balance_view row count:', r.rows[0].count);
  console.log('Done.');
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
