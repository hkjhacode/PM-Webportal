import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LoginSchema } from '@/lib/validation';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, blacklistToken } from '@/lib/auth';
import { isDevMode, findDevUserByEmail } from '@/lib/dev-user-store';
import { auditLogger } from '@/lib/audit-logger';

/**
 * /api/auth
 * Supports actions: login, logout, refresh
 * Traceability: FR-01, FR-02, FR-03
 */

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  const action = body?.action || 'login';

  if (action === 'login') {
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }
    const { email, password } = parsed.data;
    await connectDB();
    const user = isDevMode() ? null : await User.findOne({ email });
    const devUser = isDevMode() ? findDevUserByEmail(email) : null;
    if (!user && !devUser) {
      await auditLogger.logAuthentication(
        'login_failed',
        'unknown',
        'unknown',
        {
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          failureReason: 'user_not_found'
        }
      );
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const noPasswordSet = user ? !user.passwordHash : devUser ? !devUser.passwordHash : true;
    if (noPasswordSet) {
      await auditLogger.logAuthentication(
        'login_failed',
        String((user?._id) || (devUser?.id) || 'unknown'),
        (user?.roles?.[0]?.role) || (devUser?.roles?.[0]?.role) || 'unknown',
        {
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          failureReason: 'no_password_set'
        }
      );
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const ok = user ? await verifyPassword(password, user.passwordHash) : devUser ? await verifyPassword(password, devUser.passwordHash) : false;
    if (!ok) {
      await auditLogger.logAuthentication(
        'login_failed',
        String(user._id),
        user.roles?.[0]?.role || 'unknown',
        {
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          failureReason: 'invalid_password'
        }
      );
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const targetUser: any = user || devUser!;
    const accessToken = signAccessToken(targetUser);
    const refreshToken = signRefreshToken(targetUser);
    
    await auditLogger.logAuthentication(
      'login',
      String(targetUser._id || targetUser.id),
      (targetUser.roles?.[0]?.role) || 'unknown',
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );
    
    const res = NextResponse.json({
      user: {
        id: String(targetUser._id || targetUser.id),
        name: targetUser.name,
        email: targetUser.email,
        roles: targetUser.roles,
        state: targetUser.state,
        branch: targetUser.branch,
      },
      // Expose tokens for non-browser clients (dev/testing)
      accessToken,
      refreshToken,
    });
    res.cookies.set('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 24 * 3600 });
    res.cookies.set('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 3600 });
    return res;
  }

  if (action === 'logout') {
    const accessToken = req.cookies.get('accessToken')?.value;
    if (accessToken) await blacklistToken(accessToken);
    
    await auditLogger.logAuthentication(
      'logout',
      'unknown',
      'unknown',
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );
    
    const res = NextResponse.json({ ok: true });
    res.cookies.set('accessToken', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0 });
    res.cookies.set('refreshToken', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0 });
    return res;
  }

  if (action === 'refresh') {
    // Simplified: issue new access token if refresh is present; validation handled in lib/auth.
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (!refreshToken) return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    await connectDB();
    // Using verifyRefreshToken directly omitted for brevity; fetch user by decoded.sub
    // In MVP, just return 401 if not present.
    return NextResponse.json({ error: 'Not Implemented' }, { status: 501 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
