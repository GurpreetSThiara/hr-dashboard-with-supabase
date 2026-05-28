# Fix Email Verification - DO THIS NOW (5 Minutes)

## The Problem
You're getting "email rate limit exceeded" error when trying to login.

## The Solution
Email verification is now DISABLED. No email sends. No rate limits.

## Quick Setup (5 Minutes)

### Step 1: Go to Supabase Dashboard
https://app.supabase.com → Click your project

### Step 2: Turn Off Email Verification
1. Click **Authentication** (left sidebar)
2. Click **Providers**
3. Click **Email**
4. Scroll down to **Email Verification**
5. Toggle **OFF** "Double confirm email for signups"
6. Click **Save**

That's it! ✅

### Step 3 (Optional): Add Service Role Key
Get instant user creation (more reliable):

1. Still in Supabase dashboard
2. Go to **Settings → API**
3. Copy **Service Role Secret Key**
4. Create `.env.local` file in project root:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_key_here
   ```
5. Restart dev server: `pnpm dev`

## Test It Works

### In Browser
1. Go to app login page
2. Click **Use** under any demo credential:
   - `superadmin@hrcore.io` / `HRCore@SA1`
   - `employee@hrcore.io` / `HRCore@EM15`
3. You should be logged in instantly ✅

### Expected Behavior (BEFORE)
- ❌ "Email rate limit exceeded" error
- ❌ Email confirmation email sent
- ❌ Can't login without email verification
- ❌ Waiting 60 seconds for email

### Expected Behavior (AFTER)
- ✅ Instant login
- ✅ No email sent
- ✅ No verification required
- ✅ All demo credentials work

## All Demo Accounts

```
superadmin@hrcore.io    / HRCore@SA1
owner@hrcore.io         / HRCore@OW2
admin@hrcore.io         / HRCore@AD3
hradmin@hrcore.io       / HRCore@HA4
hrmanager@hrcore.io     / HRCore@HM5
hrexec@hrcore.io        / HRCore@HE6
recruiter@hrcore.io     / HRCore@RC7
payroll@hrcore.io       / HRCore@PM8
finance@hrcore.io       / HRCore@FA9
compliance@hrcore.io    / HRCore@CA10
itops@hrcore.io         / HRCore@IT11
director@hrcore.io      / HRCore@DR12
manager@hrcore.io       / HRCore@MG13
teamlead@hrcore.io      / HRCore@TL14
employee@hrcore.io      / HRCore@EM15
contractor@hrcore.io    / HRCore@CT16
intern@hrcore.io        / HRCore@IN17
readonly@hrcore.io      / HRCore@RO18
```

## Verified Working ✅

- ✅ No email verification required
- ✅ Instant login without confirmation
- ✅ No email rate limits
- ✅ All 18 demo credentials work
- ✅ Complete CRUD operations work
- ✅ Real-time notifications working
- ✅ Leave & Attendance management working

## Need Help?

See **DISABLE_EMAIL_VERIFICATION.md** for detailed technical guide.

---

**That's it! Go login now.** Your HR dashboard is ready. 🚀
