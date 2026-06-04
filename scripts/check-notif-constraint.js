const { Client } = require('pg');
async function run(){
  const c = new Client({connectionString: process.env.POSTGRES_URL});
  await c.connect();
  const chk = await c.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
    WHERE rel.relname='notifications' AND con.contype='c'`);
  console.log('notifications CHECK constraints:', chk.rows.length ? JSON.stringify(chk.rows) : 'none');
  // Test insert of new types then rollback
  await c.query('BEGIN');
  await c.query(`INSERT INTO notifications (recipient_email,type,title,message) VALUES ('t@t.io','regularization_submitted','x','y'),('t@t.io','regularization_updated','x','y')`);
  console.log('✓ both regularization notification types insert OK');
  await c.query('ROLLBACK');
  await c.end();
}
run().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
