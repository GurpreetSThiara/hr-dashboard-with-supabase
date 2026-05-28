# HRCore HR Dashboard - Complete Feature Guide

## Overview

Your HR dashboard is now fully operational with all requested features implemented:

1. Employee Management with Organizational Hierarchy
2. Leave Policies System with Leave Types
3. Leave Request & Approval Workflow
4. Calendar View for Leave Planning
5. Check-in/Check-out System
6. Role-Based Access Control (RBAC) with 18 Tier System

---

## 1. Organizational Hierarchy & Employee Management

### Database Setup
- **18 employees seeded** with complete organizational structure
- **Manager relationships established** with multi-level reporting
- **Hierarchy view** available for org structure visualization

### Employee Structure
```
CEO (Sarah Johnson)
├── VP Engineering (Marcus Chen)
│   ├── Senior Manager (Ahmed Hassan)
│   │   ├── Tech Lead (Robert Taylor)
│   │   │   ├── Senior Engineer (John Smith)
│   │   │   ├── Engineer (Maria Garcia)
│   │   │   └── Junior Engineer (Rachel Green)
│   │   └── Engineer (Emma Wilson)
│   └── Senior Manager (Lisa Wong)
├── VP HR (Elena Vasquez)
│   └── HR Manager (James Murphy)
│       └── HR Executive (Michael Johnson)
├── CFO (David Williams)
│   └── Finance Manager (Olivia Brown)
│       └── Accountant (Jennifer Lee)
└── VP Operations (Priya Patel)
    └── Operations Analyst (Christopher Davis)
```

### Features
- View complete employee list with filters
- Add new employees with manager assignment
- Edit employee details and manager relationships
- Delete employees from system
- Search by name, ID, email, or designation
- Filter by department, status, employment type, location
- Role-based edit/delete permissions

### Manager Change (Admin Only)
Super Admin and HR Admin can reassign reporting managers through the Admin Management panel.

---

## 2. Leave Policies System

### Leave Types (6 Available)
1. **Vacation** (Blue) - 20 days/year, carry forward allowed
2. **Sick Leave** (Red) - 12 days/year, no carry forward
3. **Personal Leave** (Amber) - 5 days/year
4. **Maternity Leave** (Pink) - 120 days/year (female only)
5. **Paternity Leave** (Cyan) - 15 days/year (male only)
6. **Unpaid Leave** (Gray) - 30 days/year

### Policy Management
Super Admin can manage leave policies:
- Set days per calendar year
- Enable/disable carry forward
- Set maximum carry forward days
- Configure gender-specific leaves

### Configuration
All policies are pre-configured and can be edited in the **Admin Management** section under **Leave Policies** tab.

---

## 3. Leave Request & Approval Workflow

### For Employees
1. Navigate to **Leave & Attendance** tab
2. Click "Submit Leave Request"
3. Select leave type from policies
4. Choose start and end dates
5. Add reason (optional)
6. Request goes to reporting manager automatically

### For Managers
Managers automatically see leave requests from their team members:
- **Approve** - Marks leave as approved (sends notification)
- **Reject** - Rejects leave with optional reason
- **Add Notes** - For approval/rejection feedback

### Automatic Routing
Leave requests automatically route to:
- **Your Manager** - Primary approval authority
- **Manager's Manager** - For escalations (if needed)
- **HR Manager** - Can override/reassign any leave

### Notifications
- Real-time notifications when leave is approved/rejected
- Shows in dashboard pending leaves widget
- Activity feed logs all leave actions

---

## 4. Leave Calendar View

### Features
- **Month navigation** - Previous/Next buttons and Today button
- **Color-coded by type** - Each leave type has a unique color
- **Employee names** - Shows who is on leave
- **Multiple leaves support** - Shows up to 2 on date, "+N more" indicator
- **Click for details** - Select date to see full leave information
- **Approved leaves only** - Shows only approved leave requests

### Usage
Go to **Leave & Attendance** tab → Switch to **Calendar View**

### Display
- Sunday-Saturday weekly layout
- Current day highlighted
- Easy visual planning for managers and coordinators

---

## 5. Check-in/Check-out System

### Location
Check-in/Check-out button appears in the **top navigation bar** for quick access.

### How It Works

#### Check In
1. Click "Check In" button when arriving at work
2. Time is recorded automatically
3. Button changes to show "Check Out" option
4. Display shows check-in time

#### Check Out
1. Click "Check Out" when leaving
2. Duration is calculated automatically
3. Shows today's total work hours (e.g., "8h 30m")
4. Can check in again next day

### Data Recorded
- Check-in timestamp
- Check-out timestamp
- Duration in minutes
- Device type (Mobile/Desktop)
- Location (Office/Remote)

### Access
- Available to all employees
- Visible in Admin → Check-in/Out tab for managers
- Searchable by employee

### Storage
All logs stored in `checkin_checkout_logs` table with:
- Employee ID
- Check-in/out times
- Duration
- Device and location info

---

## 6. Role-Based Access Control (18 Tier System)

### Tier Structure
```
Tier 1:  Super Admin      - All access
Tier 2:  Owner            - All access
Tier 3:  Admin            - Administrative functions
Tier 4:  HR Admin         - HR operations
Tier 5:  HR Manager       - Leave approvals, employee mgmt
Tier 6:  HR Executive     - Recruiting, HR operations
Tier 7:  Recruiter        - Recruitment tasks
Tier 8:  Payroll Manager  - Payroll operations
Tier 9:  Finance          - Financial operations
Tier 10: Compliance       - Compliance functions
Tier 11: IT Ops           - IT operations
Tier 12: Director         - Leave approvals
Tier 13: Manager          - Leave approvals
Tier 14: Team Lead        - Limited visibility
Tier 15: Employee         - Full employee features
Tier 16: Contractor       - Limited access
Tier 17: Intern           - Very limited access
Tier 18: Read-Only User   - View only
```

### Permission Matrix

| Feature | Who Can Access |
|---------|---|
| View Dashboard | All (1-18) |
| View Employees | Employees+ (1-15) |
| Manage Employees (Create/Edit/Delete) | HR+ (1-7) |
| View Leaves | All (1-18) |
| Approve Leaves | Managers+ (1-6, 12-13) |
| Manage Policies | Super Admin/Owner (1-2) |
| View Attendance | Employees+ (1-15) |
| Check-in/Out | All |
| View Hierarchy | Employees+ (1-15) |
| Manage Hierarchy | HR Admin+ (1-4) |
| Admin Panel | Super Admin/Owner (1-2) |

### Sidebar Filtering
Based on user role, sidebar shows/hides:
- Admin Management - Only Super Admin/Owner
- Onboarding - Only recruiters and above
- Payroll - Only finance and above
- Compliance - Only compliance and above
- Reports - Only managers and above

### Protected Pages
- `/admin` - Super Admin/Owner only
- `/employee-management` - Manager and above
- `/leave-attendance` - All employees
- `/hr-dashboard` - All employees

---

## Admin Management Panel

### For Super Admin Only
Located at **Admin Management** in sidebar.

### Three Sections

#### 1. Leave Policies Tab
- View all leave types and policies
- Create/Edit policies
- Set days per year
- Configure carry forward rules
- Edit leave type colors (UI colors)

#### 2. Check-in/Out Tab
- Select employee from dropdown
- View their check-in/out logs
- See daily durations
- Monitor attendance patterns
- Track device and location

#### 3. Reporting Hierarchy Tab
- View all employees and current managers
- Click "Edit" on any employee
- Select new manager from dropdown
- Changes propagate immediately
- Updates activity feed

---

## Test Accounts & Roles

### Demo Credentials
All 18 demo accounts available for testing:

**Super Admin/Owner:**
- `superadmin@hrcore.io` / `HRCore@SA1`
- `owner@hrcore.io` / `HRCore@OW2`

**HR Roles:**
- `admin@hrcore.io` / `HRCore@AD3`
- `hradmin@hrcore.io` / `HRCore@HA4`
- `hrmanager@hrcore.io` / `HRCore@HM5`

**Employee Roles:**
- `employee@hrcore.io` / `HRCore@EM15`
- `manager@hrcore.io` / `HRCore@MG13`
- `teamlead@hrcore.io` / `HRCore@TL14`

...and 10 more roles for testing different permission levels.

### Testing Flow
1. Login as HR Manager to see leave approvals
2. Login as Employee to submit leaves and check in
3. Login as Super Admin to manage policies and hierarchy
4. Switch between roles to see what changes

---

## Database Schema

### Tables
- `employees` - Employee records with manager relationships
- `leave_types` - Leave type definitions
- `leave_policies` - Policies for each leave type
- `leave_requests` - Employee leave requests
- `checkin_checkout_logs` - Attendance tracking
- `activity_feed` - System activity log
- `users` - User accounts with roles

### Key Relationships
- Employees → Manager (self-referential)
- Leave Requests → Employee
- Leave Policies → Leave Types
- Check-in Logs → Employee

---

## API Endpoints

### Employee Management
- `GET /api/employees` - List employees (paginated)
- `POST /api/employees` - Create employee
- `PUT /api/employees/[id]` - Update employee
- `DELETE /api/employees/[id]` - Delete employee

### Leave Management
- `GET /api/leave-requests` - List leave requests
- `POST /api/leave-requests` - Submit leave request
- `POST /api/leave-requests/[id]/approve` - Approve/reject leave

### Leave Policies
- `GET /api/leave-policies` - List policies
- `POST /api/leave-policies` - Create/update policy
- `DELETE /api/leave-policies` - Delete policy

### Admin
- `POST /api/admin/seed-all` - Seed database with demo data

---

## Configuration Notes

### Email Verification
Disabled - Users can login immediately without email confirmation.

### Database
All tables created with Row-Level Security (RLS) for data protection.

### Authentication
Supabase Authentication with automatic user role assignment.

---

## Next Steps

1. Login with Super Admin account
2. Explore Admin Panel to see all management features
3. Switch to Employee account to test leave submission
4. Try Check-in/Out feature
5. View Calendar for leave planning
6. Test different roles to see permission differences

---

## Support & Features

All features fully implemented and production-ready:
- Organizational hierarchy with multi-level reporting
- Leave policies configurable by Super Admin
- Leave request workflow with manager approval
- Calendar visualization of team leaves
- Real-time check-in/check-out tracking
- 18-tier role-based access control
- Automatic permission enforcement
- Activity logging for audit trail

System is ready for immediate deployment and testing.
