# HRCore - Supabase Integration Guide

## Overview

This HR management dashboard is now fully integrated with Supabase with role-based access control (RBAC) at the action level. All hardcoded data has been moved to Supabase, enabling real data management across three main tabs: HR Dashboard, Employee Management, and Leave Attendance.

## Database Schema

### Tables Created

1. **users** - User profiles with roles and permissions
   - id (UUID) - Primary key linked to auth.users
   - email (TEXT) - Unique email
   - full_name (TEXT) - User's full name
   - role (TEXT) - User role (Super Admin, HR Manager, Employee, etc.)
   - tier (INTEGER) - Role tier (1-18)
   - department (TEXT) - User's department
   - location (TEXT) - User's location
   - created_at, updated_at (TIMESTAMP)

2. **employees** - Employee records
   - id (UUID) - Primary key
   - emp_id (TEXT) - Unique employee ID (EMP-0001, etc.)
   - first_name, last_name (TEXT) - Employee name
   - email (TEXT) - Unique employee email
   - department (TEXT) - Department
   - designation (TEXT) - Job title
   - employment_type (TEXT) - Full-Time, Contractor, Intern, etc.
   - manager (TEXT) - Manager name
   - join_date (DATE) - Joining date
   - status (TEXT) - active, onleave, onboarding, terminated
   - attendance_pct (NUMERIC) - Attendance percentage
   - salary_band (TEXT) - Salary band (L1-L9, C1-C3, I1)
   - location (TEXT) - Work location
   - created_at, updated_at (TIMESTAMP)

3. **leave_requests** - Leave request records
   - id (UUID) - Primary key
   - employee_id (UUID) - Foreign key to employees
   - employee_name (TEXT) - Employee name
   - employee_initials (TEXT) - Employee initials (MC, AO, etc.)
   - avatar_color (TEXT) - Avatar background color
   - department (TEXT) - Department
   - leave_type (TEXT) - Annual Leave, Sick Leave, Compensatory, etc.
   - days (INTEGER) - Number of days requested
   - start_date (DATE) - Leave start date
   - end_date (DATE) - Leave end date
   - reason (TEXT) - Reason for leave
   - status (TEXT) - pending, approved, rejected
   - created_at, updated_at (TIMESTAMP)

4. **activity_feed** - System activity log
   - id (UUID) - Primary key
   - icon (TEXT) - Icon name
   - icon_color (TEXT) - Icon color class
   - icon_bg (TEXT) - Icon background color class
   - description (TEXT) - Activity description
   - created_at (TIMESTAMP)

5. **attendance_records** - Daily attendance tracking
   - id (UUID) - Primary key
   - employee_id (UUID) - Foreign key to employees
   - attendance_date (DATE) - Attendance date
   - status (TEXT) - present, absent
   - created_at (TIMESTAMP)

## Role-Based Access Control (RBAC)

### Role Tiers (1-18)

```
Tier 1:  Super Admin       - Full access to all features and data
Tier 2:  Owner             - Organization owner, full access
Tier 3:  Admin             - System administrator
Tier 4:  HR Admin          - HR administration
Tier 5:  HR Manager        - HR management
Tier 6:  HR Executive      - HR strategic role
Tier 7:  Recruiter         - Recruitment operations
Tier 8:  Payroll Manager   - Payroll management
Tier 9:  Finance/Accounts  - Finance role
Tier 10: Compliance/Auditor- Compliance oversight
Tier 11: IT/Admin Ops      - IT administration
Tier 12: Director          - Department director
Tier 13: Manager           - Team manager
Tier 14: Team Lead         - Team lead
Tier 15: Employee          - Regular employee
Tier 16: Contractor        - Contractor/vendor
Tier 17: Intern            - Intern
Tier 18: Read-Only User    - View-only access
```

### Permission Matrix

| Action | Super Admin | HR Mgmt | Manager | Employee | Contractor | Read-Only |
|--------|-------------|---------|---------|----------|-----------|-----------|
| View All Employees | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Edit Employee Data | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Employees | ✅ | ⚠️ HR Only | ❌ | ❌ | ❌ | ❌ |
| Approve Leave | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Submit Leave | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Own Leave | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### Row Level Security (RLS) Policies

All tables have RLS enabled with the following policies:

- **users**: Users can see their own profile
- **employees**: HR and Admin roles can see all; Employees can see their department
- **leave_requests**: HR/Managers can approve; Employees can see their own requests
- **activity_feed**: Everyone can read (public activity)
- **attendance**: HR and Managers only

## Data Seeding

### Automatic Seeding

Call the seed API endpoint to populate the database:

```bash
curl -X POST http://localhost:3000/api/seed
```

This will populate:
- 18 sample employees across 8 departments
- 5 sample leave requests
- 6 sample activity feed entries
- Attendance records for today

### Manual Seeding

Use the seed SQL scripts in `/scripts/`:
- `setup-database.sql` - Creates all tables and indexes
- `seed-data.sql` - Inserts sample data

## Authentication Flow

1. User signs in with email/password at `/sign-up-login-screen`
2. Credentials are verified against demo accounts
3. User is authenticated via Supabase Auth
4. User profile is created/updated in `users` table with role
5. Role is fetched on component mount for permission checks
6. All data fetches include role-based filters

## Demo Credentials

18 demo accounts are available, one for each role tier:

```
Super Admin:        superadmin@hrcore.io    / HRCore@SA1
Owner:              owner@hrcore.io         / HRCore@OW2
Admin:              admin@hrcore.io         / HRCore@AD3
HR Admin:           hradmin@hrcore.io       / HRCore@HA4
HR Manager:         hrmanager@hrcore.io     / HRCore@HM5
HR Executive:       hrexec@hrcore.io        / HRCore@HE6
Recruiter:          recruiter@hrcore.io     / HRCore@RC7
Payroll Manager:    payroll@hrcore.io       / HRCore@PM8
Finance/Accounts:   finance@hrcore.io       / HRCore@FA9
Compliance/Auditor: compliance@hrcore.io    / HRCore@CA10
IT/Admin Ops:       itops@hrcore.io         / HRCore@IT11
Director:           director@hrcore.io      / HRCore@DR12
Manager:            manager@hrcore.io       / HRCore@MG13
Team Lead:          teamlead@hrcore.io      / HRCore@TL14
Employee:           employee@hrcore.io      / HRCore@EM15
Contractor:         contractor@hrcore.io    / HRCore@CT16
Intern:             intern@hrcore.io        / HRCore@IN17
Read-Only User:     readonly@hrcore.io      / HRCore@RO18
```

## Feature Implementation

### 1. HR Dashboard Tab
- **Live Metrics**: Total headcount, active employees, on leave, onboarding
- **Attendance**: Real-time attendance percentage
- **Pending Leaves**: Shows count of pending leave requests (RBAC: Only visible to HR/Managers)
- **Payroll Status**: Payroll processing progress
- **Attrition Rate**: Monthly attrition statistics
- **Open Requisitions**: Recruitment pipeline
- **Onboarding Rate**: New hire completion status
- **Policy Acknowledgment**: Policy acceptance tracking
- **Activity Feed**: Real-time system activity log
- **Leave Approvals**: Pending leaves with approve/reject actions (RBAC protected)

### 2. Employee Management Tab
- **Summary Cards**: Quick metrics on employee count and status
- **Employee Table**: Full employee directory with:
  - Search by name, ID, email, or designation
  - Filter by department, status, employment type, location
  - Sort by any column
  - Pagination with adjustable page size
  - Role-based edit/delete buttons (RBAC)
  - 18 sample employees loaded from Supabase

### 3. Leave Attendance Management
- **Pending Leave Requests**: Dashboard side panel shows pending approvals
- **Approval Workflow**: Approve/reject with role-based permissions
- **Leave History**: Track all leave requests with status
- **Reasons**: View leave reasons for context

## Components with Supabase Integration

### Updated Components:
1. **EmployeeTableSection.tsx**
   - Fetches all employees from Supabase
   - Real-time filtering, sorting, pagination
   - Role-based action visibility (Edit/Delete)
   - Delete functionality with confirmation

2. **DashboardBentoGrid.tsx**
   - Fetches employee counts and statuses
   - Calculates attendance percentage
   - Updates pending leave count
   - Real-time metric calculations

3. **DashboardSidePanel.tsx**
   - Fetches pending leave requests
   - Fetches activity feed
   - Role-based approval permissions
   - Approve/reject leave with database updates

4. **EmployeeSummaryCards.tsx**
   - Fetches real employee metrics
   - Calculates active, on-leave, onboarding counts
   - Updates on data changes

5. **LoginForm.tsx**
   - Authenticates via Supabase Auth
   - Creates/updates user profile with role
   - Validates against demo credentials
   - Sets up user session for RBAC

## Environment Variables

Required Supabase environment variables (automatically set):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
POSTGRES_URL=your_postgres_url
```

## Installation & Setup

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Set Up Supabase**
   - Connect Supabase integration in v0 settings
   - Ensure environment variables are set

3. **Seed the Database**
   ```bash
   curl -X POST http://localhost:3000/api/seed
   ```

4. **Start Development Server**
   ```bash
   pnpm dev
   ```

5. **Access the Application**
   - Navigate to `http://localhost:3000/sign-up-login-screen`
   - Sign in with any demo credential
   - Dashboard, employee management, and leave features are now live

## Testing RBAC

1. Sign in as **Super Admin** (`superadmin@hrcore.io`)
   - See all employees and all actions
   - Can approve/reject leaves
   - Can edit and delete employees

2. Sign in as **HR Manager** (`hrmanager@hrcore.io`)
   - See all employees
   - Can approve/reject leaves
   - Cannot delete employees

3. Sign in as **Manager** (`manager@hrcore.io`)
   - See employees
   - Can approve/reject leaves
   - Cannot edit/delete

4. Sign in as **Employee** (`employee@hrcore.io`)
   - Limited data visibility
   - Cannot approve leaves or manage others

5. Sign in as **Read-Only User** (`readonly@hrcore.io`)
   - Can view all data
   - No edit/delete/action capabilities

## File Structure

```
src/
├── app/
│   ├── api/seed/route.ts           # Database seeding endpoint
│   ├── hr-dashboard/
│   │   ├── components/
│   │   │   ├── DashboardBentoGrid.tsx
│   │   │   ├── DashboardSidePanel.tsx
│   │   │   └── ...
│   │   └── page.tsx
│   ├── employee-management/
│   │   ├── components/
│   │   │   ├── EmployeeTableSection.tsx
│   │   │   ├── EmployeeSummaryCards.tsx
│   │   │   └── ...
│   │   └── page.tsx
│   ├── sign-up-login-screen/
│   │   ├── components/
│   │   │   └── LoginForm.tsx
│   │   └── page.tsx
│   └── layout.tsx                  # Root layout with AuthProvider
├── contexts/
│   └── AuthContext.tsx             # Authentication context
├── lib/
│   ├── supabase/
│   │   └── client.ts               # Supabase client
│   └── hooks.ts                    # Data fetching hooks
└── scripts/
    ├── setup-database.sql
    └── seed-data.sql
```

## Key Features Implemented

✅ Complete Supabase integration
✅ 18-level role-based access control
✅ Row-level security policies
✅ Real employee data from database
✅ Real leave request management
✅ Role-based action visibility
✅ Activity feed system
✅ Attendance tracking
✅ Dashboard metrics
✅ Employee directory with filtering
✅ Leave approval workflow
✅ Role-based authentication
✅ Secure data fetching

## Troubleshooting

### No data showing
1. Check Supabase connection in settings
2. Verify environment variables are set
3. Call `/api/seed` to populate database
4. Check browser console for errors

### Role-based actions not showing
1. Ensure user role is in `users` table
2. Check role string matches permission checks
3. Verify authentication session is active
4. Check browser DevTools > Application > Cookies for session

### Login failing
1. Ensure email/password matches demo credentials exactly
2. Check Supabase auth is enabled
3. Verify NEXT_PUBLIC_SUPABASE_URL and ANON_KEY are correct
4. Check browser console for detailed error messages

## Next Steps

To extend this system:

1. Add more roles/permissions in `users` table
2. Create additional tables for other HR functions
3. Build custom reports with real data
4. Add workflow automation
5. Integrate with external systems
6. Implement audit logging
7. Add email notifications
8. Create mobile app with same backend

For support, refer to Supabase documentation: https://supabase.com/docs
