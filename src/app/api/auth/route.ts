import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LoginSchema } from '@/lib/validation';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, blacklistToken } from '@/lib/auth';

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
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const res = NextResponse.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        roles: user.roles,
        state: user.state,
        branch: user.branch,
      },
      // Expose tokens for non-browser clients (dev/testing)
      accessToken,
      refreshToken,
    });
    res.cookies.set('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 24 * 3600 });
    res.cookies.set('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 });
    return res;
  }

  if (action === 'logout') {
    const accessToken = req.cookies.get('accessToken')?.value;
    if (accessToken) await blacklistToken(accessToken);
    const res = NextResponse.json({ ok: true });
    res.cookies.set('accessToken', '', { httpOnly: true, secure: true, maxAge: 0 });
    res.cookies.set('refreshToken', '', { httpOnly: true, secure: true, maxAge: 0 });
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
