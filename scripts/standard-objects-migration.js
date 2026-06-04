const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  // Read-only registry of system objects
  await c.query(`
    CREATE TABLE IF NOT EXISTS standard_objects (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      api_name    text NOT NULL UNIQUE,
      label       text NOT NULL,
      plural_label text,
      table_name  text NOT NULL,
      description text,
      icon        text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Fields + relationships on standard objects. is_custom distinguishes
  // system-defined (immutable except is_visible) from admin-created customs.
  await c.query(`
    CREATE TABLE IF NOT EXISTS standard_object_fields (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      object_api_name text NOT NULL,
      api_name        text NOT NULL,
      label           text NOT NULL,
      data_type       text NOT NULL DEFAULT 'text',
      is_relationship boolean NOT NULL DEFAULT false,
      related_object  text,
      is_custom       boolean NOT NULL DEFAULT false,
      is_visible      boolean NOT NULL DEFAULT true,
      is_required     boolean NOT NULL DEFAULT false,
      picklist_values jsonb,
      created_by      text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      UNIQUE (object_api_name, api_name)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_sof_object ON standard_object_fields(object_api_name)`);

  for (const t of ['standard_objects', 'standard_object_fields']) {
    await c.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await c.query(`DROP POLICY IF EXISTS ${t}_read ON ${t}`);
    await c.query(`CREATE POLICY ${t}_read ON ${t} FOR SELECT TO authenticated USING (true)`);
  }
  console.log('✓ standard_objects + standard_object_fields + RLS');

  // ── Seed registry ──────────────────────────────────────────────────────────
  const objects = [
    ['employee', 'Employee', 'Employees', 'employees', 'Company employees and their profile data', 'UsersIcon'],
    ['leave_request', 'Leave Request', 'Leave Requests', 'leave_requests', 'Employee leave applications', 'CalendarDaysIcon'],
    ['attendance_record', 'Attendance Record', 'Attendance Records', 'attendance_records', 'Daily attendance status', 'ClockIcon'],
    ['regularization', 'Regularization', 'Regularizations', 'attendance_regularizations', 'Attendance correction requests', 'DocumentTextIcon'],
    ['checkin_log', 'Check-in Log', 'Check-in Logs', 'checkin_checkout_logs', 'Check-in / check-out sessions', 'ArrowRightOnRectangleIcon'],
    ['holiday', 'Holiday', 'Holidays', 'company_holidays', 'Company holiday calendar', 'SunIcon'],
  ];
  for (const [api, label, plural, table, desc, icon] of objects) {
    await c.query(
      `INSERT INTO standard_objects (api_name,label,plural_label,table_name,description,icon)
       SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM standard_objects WHERE api_name=$1)`,
      [api, label, plural, table, desc, icon]
    );
  }

  // ── Seed standard fields/relationships (is_custom=false) ─────────────────────
  // [object, api_name, label, data_type, is_relationship, related_object]
  const fields = [
    // Employee
    ['employee','emp_id','Employee ID','text',false,null],
    ['employee','first_name','First Name','text',false,null],
    ['employee','last_name','Last Name','text',false,null],
    ['employee','email','Company Email','email',false,null],
    ['employee','department','Department','text',false,null],
    ['employee','designation','Designation','text',false,null],
    ['employee','employment_type','Employment Type','picklist',false,null],
    ['employee','manager','Reporting Manager','lookup',true,'employee'],
    ['employee','join_date','Join Date','date',false,null],
    ['employee','status','Status','picklist',false,null],
    ['employee','location','Location','text',false,null],
    ['employee','salary_band','Salary Band','text',false,null],
    ['employee','attendance_pct','Attendance %','number',false,null],
    // Leave Request
    ['leave_request','employee_id','Employee','lookup',true,'employee'],
    ['leave_request','leave_type','Leave Type','picklist',false,null],
    ['leave_request','start_date','Start Date','date',false,null],
    ['leave_request','end_date','End Date','date',false,null],
    ['leave_request','days_count','Days','number',false,null],
    ['leave_request','reason','Reason','text',false,null],
    ['leave_request','status','Status','picklist',false,null],
    ['leave_request','approver_email','Approver','email',false,null],
    // Attendance Record
    ['attendance_record','employee_id','Employee','lookup',true,'employee'],
    ['attendance_record','attendance_date','Date','date',false,null],
    ['attendance_record','status','Status','picklist',false,null],
    // Regularization
    ['regularization','employee_id','Employee','lookup',true,'employee'],
    ['regularization','date','Date','date',false,null],
    ['regularization','requested_check_in','Requested Check-in','datetime',false,null],
    ['regularization','requested_check_out','Requested Check-out','datetime',false,null],
    ['regularization','reason','Reason','text',false,null],
    ['regularization','status','Status','picklist',false,null],
    // Check-in Log
    ['checkin_log','employee_id','Employee','lookup',true,'employee'],
    ['checkin_log','check_in_time','Check-in Time','datetime',false,null],
    ['checkin_log','check_out_time','Check-out Time','datetime',false,null],
    ['checkin_log','duration_minutes','Duration (min)','number',false,null],
    ['checkin_log','location','Location','text',false,null],
    // Holiday
    ['holiday','name','Name','text',false,null],
    ['holiday','date','Date','date',false,null],
    ['holiday','holiday_type','Type','picklist',false,null],
    ['holiday','description','Description','text',false,null],
  ];
  let seeded = 0;
  for (const [obj, api, label, type, isRel, rel] of fields) {
    const r = await c.query(
      `INSERT INTO standard_object_fields (object_api_name,api_name,label,data_type,is_relationship,related_object,is_custom,is_visible)
       SELECT $1,$2,$3,$4,$5,$6,false,true
       WHERE NOT EXISTS (SELECT 1 FROM standard_object_fields WHERE object_api_name=$1 AND api_name=$2)`,
      [obj, api, label, type, isRel, rel]
    );
    seeded += r.rowCount;
  }
  console.log(`✓ seeded ${objects.length} standard objects + ${seeded} standard fields/relationships`);

  await c.end();
}
run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
