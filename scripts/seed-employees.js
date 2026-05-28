const { Client } = require('pg');

// Parse connection string to handle SSL
const connectionString = process.env.POSTGRES_URL;
const connectionConfig = {
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
};

const employees = [
  // Super Admin (Tier 1) - 1 person
  { email: 'super.admin@hrcore.io', name: 'Super Admin', role: 'Super Admin', department: 'IT', position: 'System Administrator', status: 'active' },
  
  // CEO (Tier 2) - 1 person
  { email: 'ceo@hrcore.io', name: 'John Executive', role: 'CEO', department: 'Executive', position: 'Chief Executive Officer', status: 'active' },
  
  // C-Suite/Director (Tier 3) - Admin role - 3 people
  { email: 'admin1@hrcore.io', name: 'Sarah Williams', role: 'Admin', department: 'HR', position: 'HR Director', status: 'active' },
  { email: 'admin2@hrcore.io', name: 'Michael Chen', role: 'Admin', department: 'Finance', position: 'Finance Director', status: 'active' },
  { email: 'admin3@hrcore.io', name: 'Elena Rodriguez', role: 'Admin', department: 'Operations', position: 'Operations Director', status: 'active' },
  
  // HR Manager (Tier 5) - 2 people
  { email: 'hrmanager1@hrcore.io', name: 'David Brown', role: 'HR Manager', department: 'HR', position: 'Senior HR Manager', status: 'active' },
  { email: 'hrmanager2@hrcore.io', name: 'Lisa Johnson', role: 'HR Manager', department: 'HR', position: 'HR Manager', status: 'active' },
  
  // IT Ops (Tier 11) - 2 people
  { email: 'itops1@hrcore.io', name: 'Robert Smith', role: 'IT Ops', department: 'IT', position: 'IT Operations Manager', status: 'active' },
  { email: 'itops2@hrcore.io', name: 'Jennifer Kumar', role: 'IT Ops', department: 'IT', position: 'Senior IT Specialist', status: 'active' },
  
  // Finance Manager (Tier 9) - 2 people
  { email: 'finance1@hrcore.io', name: 'Marcus Thompson', role: 'Finance Manager', department: 'Finance', position: 'Finance Manager', status: 'active' },
  { email: 'finance2@hrcore.io', name: 'Priya Sharma', role: 'Finance Manager', department: 'Finance', position: 'Senior Accountant', status: 'active' },
  
  // Team Lead (Tier 7) - 3 people
  { email: 'teamlead1@hrcore.io', name: 'Ahmed Hassan', role: 'Team Lead', department: 'Development', position: 'Team Lead - Backend', status: 'active' },
  { email: 'teamlead2@hrcore.io', name: 'Sophie Martin', role: 'Team Lead', department: 'Development', position: 'Team Lead - Frontend', status: 'active' },
  { email: 'teamlead3@hrcore.io', name: 'James Wilson', role: 'Team Lead', department: 'Sales', position: 'Sales Team Lead', status: 'active' },
  
  // Employee (Tier 15) - 8 people
  { email: 'employee1@hrcore.io', name: 'Olivia Brown', role: 'Employee', department: 'Development', position: 'Software Engineer', status: 'active' },
  { email: 'employee2@hrcore.io', name: 'Emma Davis', role: 'Employee', department: 'Development', position: 'Frontend Developer', status: 'active' },
  { email: 'employee3@hrcore.io', name: 'Oliver Martinez', role: 'Employee', department: 'Sales', position: 'Sales Executive', status: 'active' },
  { email: 'employee4@hrcore.io', name: 'Sophia Anderson', role: 'Employee', department: 'Marketing', position: 'Marketing Specialist', status: 'active' },
  { email: 'employee5@hrcore.io', name: 'Lucas White', role: 'Employee', department: 'Operations', position: 'Operations Coordinator', status: 'active' },
  { email: 'employee6@hrcore.io', name: 'Isabella Garcia', role: 'Employee', department: 'HR', position: 'HR Coordinator', status: 'active' },
  { email: 'employee7@hrcore.io', name: 'Benjamin Taylor', role: 'Employee', department: 'Finance', position: 'Finance Analyst', status: 'active' },
  { email: 'employee8@hrcore.io', name: 'Charlotte Lopez', role: 'Employee', department: 'IT', position: 'IT Support Specialist', status: 'active' },
  
  // Read-Only (Tier 18) - 1 person
  { email: 'readonly@hrcore.io', name: 'Guest User', role: 'Read-Only', department: 'General', position: 'Guest Access', status: 'active' },
];

async function seedEmployees() {
  const client = new Client(connectionConfig);
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if table has data
    const checkResult = await client.query('SELECT COUNT(*) FROM employees');
    const currentCount = parseInt(checkResult.rows[0].count);
    
    if (currentCount > 0) {
      console.log(`Database already has ${currentCount} employees. Skipping seed.`);
      await client.end();
      return;
    }
    
    console.log(`Seeding ${employees.length} employees...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const emp of employees) {
      try {
        await client.query(
          `INSERT INTO employees (email, name, role, department, position, status, hire_date, phone, location, manager_id, salary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (email) DO NOTHING`,
          [
            emp.email,
            emp.name,
            emp.role,
            emp.department,
            emp.position,
            emp.status,
            new Date().toISOString(),
            '+1-555-0000',
            'New York, NY',
            null, // Will be set later if needed
            75000, // Default salary
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        successCount++;
        console.log(`✓ Created ${emp.name} (${emp.role})`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error creating ${emp.email}:`, error.message);
      }
    }
    
    console.log(`\nSeed complete: ${successCount} created, ${errorCount} errors`);
    
    // Verify
    const finalResult = await client.query('SELECT COUNT(*) FROM employees');
    console.log(`Total employees in database: ${finalResult.rows[0].count}`);
    
    await client.end();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedEmployees();
