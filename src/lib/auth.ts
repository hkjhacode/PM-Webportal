import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, UserDoc } from '@/models/user';
import { connectDB } from './db';

/**
 * Auth Helpers
 * Traceability: FR-01 (login), FR-02 (RBAC), FR-03 (logout/blacklist + refresh)
 */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev-refresh-secret';

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(user: UserDoc) {
  const payload = {
    sub: String(user._id),
    roles: user.roles,
    state: user.state,
    branch: user.branch,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function signRefreshToken(user: UserDoc) {
  const payload = { sub: String(user._id) };
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as any;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as any;
}

// Simple in-memory blacklist fallback if Redis not configured.
const memoryBlacklist = new Map<string, number>();

export async function blacklistToken(token: string, ttlSeconds = 24 * 3600) {
  const until = Date.now() + ttlSeconds * 1000;
  memoryBlacklist.set(token, until);
}

export function isTokenBlacklisted(token: string) {
  const until = memoryBlacklist.get(token);
  if (!until) return false;
  if (Date.now() > until) {
    memoryBlacklist.delete(token);
    return false;
  }
  return true;
}

export async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : undefined;
  const cookieToken = req.cookies.get('accessToken')?.value;
  const t = token || cookieToken;
  if (!t) return null;
  if (isTokenBlacklisted(t)) return null;
  try {
    const decoded = verifyAccessToken(t);
    await connectDB();
    const user = await User.findById(decoded.sub);
    return user || null;
  } catch {
    return null;
  }
}

export function requireRoles(user: UserDoc | null, allowedRoles: string[]) {
  if (!user) return false;
  const roles = (user.roles || []).map((r) => r.role);
  return allowedRoles.some((ar) => roles.includes(ar));
}