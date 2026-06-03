const { Client } = require('pg');
const fs = require('fs');
async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  // Recreate the leave_balance_view (it may have been missing from the DB)
  await client.query(`
    CREATE OR REPLACE VIEW leave_balance_view AS
    SELECT
      e.id,
      e.emp_id,
      e.first_name,
      e.last_name,
      lt.name   AS leave_type,
      lt.color,
      COALESCE(lpr.days_per_year, lp.days_per_year, 0)  AS days_per_year,
      COALESCE(
        SUM(CASE WHEN lr.status = 'approved'
                  AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
             THEN lr.days_count ELSE 0 END), 0
      )::int  AS days_used,
      GREATEST(0,
        COALESCE(lpr.days_per_year, lp.days_per_year, 0) -
        COALESCE(
          SUM(CASE WHEN lr.status = 'approved'
                    AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
               THEN lr.days_count ELSE 0 END), 0
        )::int
      )  AS days_remaining
    FROM employees e
    CROSS JOIN leave_types lt
    LEFT JOIN (
      SELECT r.leave_type_id, r.days_per_year
      FROM   leave_policy_rules r
      JOIN   leave_policy_versions v ON v.id = r.version_id AND v.is_active = true
    ) lpr ON lpr.leave_type_id = lt.id
    LEFT JOIN leave_policies lp ON lp.leave_type_id = lt.id
    LEFT JOIN leave_requests lr
           ON lr.employee_id = e.id AND lr.leave_type = lt.name
    WHERE e.status = 'active'
    GROUP BY e.id, e.emp_id, e.first_name, e.last_name, lt.name, lt.color,
             lpr.days_per_year, lp.days_per_year;
  `);
  console.log('leave_balance_view created/updated');

  // Comment on deprecated column
  await client.query(`
    COMMENT ON COLUMN leave_requests.days IS
      'DEPRECATED — kept for backward-compat; always equals days_count. Remove in next major migration.';
  `);
  console.log('days column comment set');

  const r = await client.query(`SELECT COUNT(*) FROM leave_balance_view`);
  console.log('leave_balance_view rows:', r.rows[0].count);

  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
