# Disable Email Verification in Supabase

## Problem Solved
Email rate limit exceeded error when trying to login. Users can now login instantly without email verification.

## What Was Changed

### 1. LoginForm Component
- Removed `emailRedirectTo` from signup options
- Removed email confirmation delays
- Uses Admin API for instant user creation

### 2. AuthContext
- Updated `signUp` function to not require email confirmation
- Removed email redirect URL

### 3. New API Endpoints
- **POST /api/auth/signup** - Create user without email verification
- **POST /api/auth/login** - Simple password login

### 4. Authentication Flow
- Users sign up/login instantly
- No email confirmation required
- No email sending (no rate limits!)
- Immediate access to dashboard

## How to Complete Setup in Supabase

### Step 1: Disable Email Verification (REQUIRED)

Go to your Supabase Dashboard:
1. Navigate to **Authentication → Providers**
2. Click on **Email** provider
3. Find **Email Verification** section
4. Set **Double confirm email for signups** to **OFF**
5. Click **Save**

### Step 2: Disable Confirmation Email (REQUIRED)

Still in **Authentication → Providers → Email**:
1. Find **Email Templates**
2. Disable automatic confirmation emails
3. Or set a high rate limit (50+ per day)

### Step 3: Update Email Rate Limits (OPTIONAL)

In **Authentication → Providers → Email**:
1. Find **Rate Limits** section
2. Increase limits or disable them
3. Examples:
   - Sign Up: Unlimited or 100+ per day
   - Password Reset: 10+ per day
   - Magic Link: 50+ per day

### Step 4: Enable Service Role (RECOMMENDED)

In Supabase Dashboard:
1. Go to **Settings → API**
2. Copy your **Service Role Secret Key**
3. Add to your `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

This enables the signup API to auto-confirm emails.

## Testing Email Verification is Disabled

### Test 1: Quick Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "role": "Employee",
    "tier": 15
  }'
```

Expected response: User created instantly, no email sent.

### Test 2: Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

Expected: Instant login, no email verification required.

### Test 3: UI Login
1. Go to app login page
2. Use any demo credential:
   - `superadmin@hrcore.io` / `HRCore@SA1`
   - `employee@hrcore.io` / `HRCore@EM15`
3. Click Sign In
4. Redirected to dashboard instantly (no email delay!)

## Demo Credentials (All Work Without Email Verification)

```
Super Admin:   superadmin@hrcore.io  / HRCore@SA1
Owner:         owner@hrcore.io       / HRCore@OW2
Admin:         admin@hrcore.io       / HRCore@AD3
HR Admin:      hradmin@hrcore.io     / HRCore@HA4
HR Manager:    hrmanager@hrcore.io   / HRCore@HM5
HR Executive:  hrexec@hrcore.io      / HRCore@HE6
Recruiter:     recruiter@hrcore.io   / HRCore@RC7
Payroll Mgr:   payroll@hrcore.io     / HRCore@PM8
Finance:       finance@hrcore.io     / HRCore@FA9
Compliance:    compliance@hrcore.io  / HRCore@CA10
IT/Ops:        itops@hrcore.io       / HRCore@IT11
Director:      director@hrcore.io    / HRCore@DR12
Manager:       manager@hrcore.io     / HRCore@MG13
Team Lead:     teamlead@hrcore.io    / HRCore@TL14
Employee:      employee@hrcore.io    / HRCore@EM15
Contractor:    contractor@hrcore.io  / HRCore@CT16
Intern:        intern@hrcore.io      / HRCore@IN17
Read-Only:     readonly@hrcore.io    / HRCore@RO18
```

## No More Email Rate Limits!

All login attempts now:
- ✅ Instant authentication
- ✅ No email sending
- ✅ No rate limits
- ✅ No verification delays
- ✅ Seamless user experience

## If You Want Email Verification Later

Simply reverse these steps:
1. Go to **Authentication → Providers → Email**
2. Enable **Double confirm email for signups**
3. Update LoginForm to use `emailRedirectTo`
4. Users will need to confirm before login

## Troubleshooting

### Still Getting Email Errors?
1. Check Supabase dashboard shows email verification OFF
2. Verify Service Role key is set in `.env.local`
3. Restart dev server: `pnpm dev`

### Users Can't Login?
1. Check users table in Supabase (should have rows)
2. Verify email is correct (case-insensitive)
3. Check console for error messages
4. Try the API endpoint directly to debug

### Too Many Failed Attempts?
Email rate limits might be blocking you. Wait 1 hour or:
1. Ask Supabase support to reset rate limits
2. Create a new test user with different email
3. Increase rate limits in Supabase dashboard

## Files Modified

- `src/app/sign-up-login-screen/components/LoginForm.tsx` - Removed email redirects
- `src/contexts/AuthContext.tsx` - Removed email confirmation requirement
- `src/app/api/auth/signup/route.ts` - New: Signup without verification
- `src/app/api/auth/login/route.ts` - New: Clean login endpoint

## Next Steps

1. Complete Supabase setup (5 minutes)
2. Restart dev server
3. Try login with any demo credential
4. You're done! No email verification needed.
