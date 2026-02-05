# Job Tickets System - Training Guide

## Overview

The Job Tickets system now uses **email-based login** instead of ID codes. Each staff member signs in with their email address and receives a secure login link - no passwords to remember!

---

## For All Staff: How to Sign In

### First-Time Login (After Receiving Invite)

1. Check your email for an invite from the system
2. Click the **"Accept Invite"** link in the email
3. You'll be signed in automatically
4. Bookmark the site for easy access

### Regular Login

1. Go to the Job Tickets website
2. Enter your **work email address**
3. Click **"Send Login Link"**
4. Check your email (including spam folder)
5. Click the **login link** in the email
6. You're signed in!

> **Note:** Login links expire after 1 hour. If your link expired, just request a new one.

### Switching Users (Shared iPads)

When it's time for another person to use the device:

1. Click the **"Switch User"** button (top right of screen)
2. You'll be signed out
3. The next person enters their email and signs in

---

## Role-Based Access

Different staff members see different parts of the system:

| Role | What They See | Main Tasks |
|------|---------------|------------|
| **Service Writer** | Intake page | Create new tickets, enter customer info |
| **Technician** | Job Queue | View assigned jobs, update status, complete work |
| **Manager** | Admin dashboard | View all tickets, reports, manage staff |

---

## For Managers: Inviting New Staff

### Step 1: Add Staff to the System

Before inviting someone, their record must exist in the staff list with an email address.

1. Go to **Admin** section
2. Navigate to **Staff Management**
3. Click **"Add Staff"**
4. Fill in:
   - Name
   - Email address
   - Role (Service Writer, Technician, or Manager)
5. Save the record

### Step 2: Send the Invite

1. Find the staff member in the list
2. Click **"Send Invite"** button
3. They'll receive an email with a link to set up their account

### Managing Staff Access

**To remove someone's access:**
1. Find them in Staff Management
2. Click **"Deactivate"**
3. Their access is revoked immediately

**To reactivate someone:**
1. Find them in Staff Management
2. Click **"Activate"**
3. Send them a new invite

---

## Common Questions

### "I didn't get the login email"

1. Check your **spam/junk folder**
2. Make sure you typed your email correctly
3. Wait 1-2 minutes (emails can be delayed)
4. Try clicking "Resend Link" (available after 60 seconds)
5. Contact your manager if it still doesn't work

### "My login link says it's expired"

Login links expire after 1 hour for security. Simply:
1. Go back to the login page
2. Enter your email again
3. Click "Send Login Link" for a fresh link

### "It says my account must be created by an administrator"

This means you haven't been invited yet. Ask your manager to:
1. Add your email to the staff list
2. Send you an invite

### "It says I don't have access to this business"

You're trying to log in to the wrong location. Make sure you're using the correct website URL for your shop.

### "The link in my email doesn't work"

- Make sure you're clicking (not copying) the link
- Try opening the link in a different browser
- Check if your email program broke the link across multiple lines
- Request a new login link

---

## Security Best Practices

1. **Never share login links** - Each link is for one person only
2. **Always switch users** - Don't stay logged in as someone else
3. **Report suspicious emails** - Only trust emails from your system's domain
4. **Log out on shared devices** - Use "Switch User" when you're done

---

## Quick Reference Card

```
┌─────────────────────────────────────────┐
│         JOB TICKETS - QUICK LOGIN       │
├─────────────────────────────────────────┤
│  1. Enter your email                    │
│  2. Click "Send Login Link"             │
│  3. Check email, click the link         │
│  4. You're in!                          │
├─────────────────────────────────────────┤
│  Switching Users:                       │
│  Click "Switch User" → Next person      │
│  enters their email                     │
├─────────────────────────────────────────┤
│  Problems? Ask your manager or          │
│  check spam folder for login email      │
└─────────────────────────────────────────┘
```

---

## For IT/Setup: Technical Notes

See `MULTI_TENANT_SETUP.md` for:
- Environment configuration
- Database migrations
- Supabase dashboard settings
- Troubleshooting RLS and auth issues
