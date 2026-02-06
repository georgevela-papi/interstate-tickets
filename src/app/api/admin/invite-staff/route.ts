import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 invites per minute per user

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  record.count++;
  return { allowed: true };
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Type for get_my_staff RPC response
interface StaffInfo {
  id: string;
  tenant_id: string;
  role: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    // ========================================
    // 1. AUTHENTICATION: Verify caller is logged in
    // ========================================
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // ========================================
    // 2. AUTHORIZATION: Verify caller is MANAGER
    // ========================================
    const { data: callerStaff, error: callerError } = await supabase
      .rpc('get_my_staff')
      .single() as { data: StaffInfo | null; error: Error | null };

    if (callerError || !callerStaff) {
      return NextResponse.json(
        { error: 'Unauthorized: Not an active staff member' },
        { status: 401 }
      );
    }

    if (callerStaff.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Forbidden: Only managers can invite staff' },
        { status: 403 }
      );
    }

    // ========================================
    // 3. RATE LIMITING
    // ========================================
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    // ========================================
    // 4. INPUT VALIDATION
    // ========================================
    const body = await request.json();
    const { staffId } = body;

    if (!staffId || typeof staffId !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: staffId is required' },
        { status: 400 }
      );
    }

    if (!isValidUUID(staffId)) {
      return NextResponse.json(
        { error: 'Bad Request: staffId must be a valid UUID' },
        { status: 400 }
      );
    }

    // ========================================
    // 5. SERVICE ROLE CLIENT (server-only secret)
    // ========================================
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ========================================
    // 6. FETCH STAFF RECORD
    // ========================================
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, email, tenant_id, role, active')
      .eq('id', staffId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: 'Staff record not found' },
        { status: 404 }
      );
    }

    // ========================================
    // 7. CROSS-TENANT PROTECTION
    // ========================================
    if (staff.tenant_id !== callerStaff.tenant_id) {
      // Log potential attack attempt
      console.warn(`Cross-tenant invite attempt: user ${user.id} (tenant ${callerStaff.tenant_id}) tried to invite staff ${staffId} (tenant ${staff.tenant_id})`);
      return NextResponse.json(
        { error: 'Forbidden: Cannot invite staff from another business' },
        { status: 403 }
      );
    }

    // ========================================
    // 8. BUSINESS VALIDATION
    // ========================================
    if (!staff.active) {
      return NextResponse.json(
        { error: 'Cannot invite deactivated staff' },
        { status: 400 }
      );
    }

    if (!staff.email) {
      return NextResponse.json(
        { error: 'Staff record must have an email before inviting' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(staff.email)) {
      return NextResponse.json(
        { error: 'Staff has invalid email format' },
        { status: 400 }
      );
    }

    // ========================================
    // 9. CHECK FOR EXISTING AUTH USER
    // ========================================
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Failed to list users:', listError);
      return NextResponse.json(
        { error: 'Failed to check existing users' },
        { status: 500 }
      );
    }

    const existingUser = existingUsers?.users.find(
      u => u.email?.toLowerCase() === staff.email.toLowerCase()
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already has an account' },
        { status: 409 }
      );
    }

    // ========================================
    // 10. SEND INVITE
    // ========================================
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      staff.email,
      {
        redirectTo: redirectUrl,
        data: {
          staff_id: staff.id,
          tenant_id: staff.tenant_id,
          role: staff.role,
        }
      }
    );

    if (inviteError) {
      console.error('Invite error:', inviteError);
      return NextResponse.json(
        { error: 'Failed to send invite. Please try again.' },
        { status: 500 }
      );
    }

    // ========================================
    // 11. SUCCESS
    // ========================================
    return NextResponse.json({
      success: true,
      message: `Invite sent to ${staff.email}`,
    });

  } catch (err) {
    console.error('Invite staff error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
