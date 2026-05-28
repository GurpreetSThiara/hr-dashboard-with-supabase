// ────────────────────────────────────────────────────────────────────────────
// Single source of truth for the 18 demo users that ship with the app.
// Mirrors scripts/seed-demo-users.mjs — keep in sync.
// ────────────────────────────────────────────────────────────────────────────

export interface DemoUser {
  email: string;
  password: string;
  role: string;
  tier: number;
  full_name: string;
  department: string;
}

export const DEMO_USERS: DemoUser[] = [
  { tier: 1,  role: 'Super Admin',     email: 'superadmin@hrcore.io', password: 'HRCore@SA1',  full_name: 'Sarah Anderson',   department: 'Executive'   },
  { tier: 2,  role: 'Owner',           email: 'owner@hrcore.io',      password: 'HRCore@OW2',  full_name: 'Marcus Chen',      department: 'Executive'   },
  { tier: 3,  role: 'Admin',           email: 'admin@hrcore.io',      password: 'HRCore@AD3',  full_name: 'Olivia Park',      department: 'IT'          },
  { tier: 4,  role: 'HR Admin',        email: 'hradmin@hrcore.io',    password: 'HRCore@HA4',  full_name: 'Elena Vasquez',    department: 'HR'          },
  { tier: 5,  role: 'HR Manager',      email: 'hrmanager@hrcore.io',  password: 'HRCore@HM5',  full_name: 'James Wilson',     department: 'HR'          },
  { tier: 6,  role: 'HR Executive',    email: 'hrexec@hrcore.io',     password: 'HRCore@HE6',  full_name: 'Priya Patel',      department: 'HR'          },
  { tier: 7,  role: 'Recruiter',       email: 'recruiter@hrcore.io',  password: 'HRCore@RC7',  full_name: 'Tom Bennett',      department: 'HR'          },
  { tier: 8,  role: 'Payroll Manager', email: 'payroll@hrcore.io',    password: 'HRCore@PM8',  full_name: 'Sophie Martin',    department: 'Finance'     },
  { tier: 9,  role: 'Finance',         email: 'finance@hrcore.io',    password: 'HRCore@FA9',  full_name: 'David Kim',        department: 'Finance'     },
  { tier: 10, role: 'Compliance',      email: 'compliance@hrcore.io', password: 'HRCore@CA10', full_name: 'Rachel Green',     department: 'Legal'       },
  { tier: 11, role: 'IT Ops',          email: 'itops@hrcore.io',      password: 'HRCore@IT11', full_name: 'Alex Turner',      department: 'IT'          },
  { tier: 12, role: 'Director',        email: 'director@hrcore.io',   password: 'HRCore@DR12', full_name: 'Michael Brown',    department: 'Engineering' },
  { tier: 13, role: 'Manager',         email: 'manager@hrcore.io',    password: 'HRCore@MG13', full_name: 'Lisa Chen',        department: 'Engineering' },
  { tier: 14, role: 'Team Lead',       email: 'teamlead@hrcore.io',   password: 'HRCore@TL14', full_name: 'Ryan Foster',      department: 'Engineering' },
  { tier: 15, role: 'Employee',        email: 'employee@hrcore.io',   password: 'HRCore@EM15', full_name: 'Jenny Liu',        department: 'Engineering' },
  { tier: 16, role: 'Contractor',      email: 'contractor@hrcore.io', password: 'HRCore@CT16', full_name: 'Carlos Mendez',    department: 'Engineering' },
  { tier: 17, role: 'Intern',          email: 'intern@hrcore.io',     password: 'HRCore@IN17', full_name: 'Aisha Khan',       department: 'Engineering' },
  { tier: 18, role: 'Read-Only User',  email: 'readonly@hrcore.io',   password: 'HRCore@RO18', full_name: 'Guest User',       department: 'External'    },
];

export const PASSWORD_BY_TIER: Record<number, string> = DEMO_USERS.reduce(
  (acc, u) => ({ ...acc, [u.tier]: u.password }),
  {}
);
