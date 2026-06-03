const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%holiday%' ORDER BY tablename`);
  console.log('Holiday tables:', tables.rows.map(r => r.tablename).join(', '));
  const holidays = await client.query(`SELECT name, date, holiday_type FROM company_holidays ORDER BY date LIMIT 12`);
  console.log('Seeded holidays:', holidays.rowCount);
  holidays.rows.forEach(r => console.log(` - ${r.name}: ${r.date} (${r.holiday_type})`));
  const triggers = await client.query(`SELECT tgname FROM pg_trigger WHERE tgname = 'trg_leave_overlap'`);
  console.log('Overlap trigger exists:', triggers.rows.length > 0 ? 'YES' : 'NO');
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
