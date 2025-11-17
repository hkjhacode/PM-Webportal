import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/user';
import { hashPassword } from '@/lib/auth';
import { isDevMode, clearDevUsers, createDevUser } from '@/lib/dev-user-store';

/**
 * Dev-only: Reset users to the specified NITI hierarchy
 * - Deletes all users
 * - Seeds PMO, CEO NITI, State Advisor (UP), State YP (UP), Division HOD (UP-Education), Division YP (UP-Education)
 * Traceability: Aligns with SRS FR-01/FR-02 (RBAC) and user's requested hierarchy
 */
export const dynamic = 'force-dynamic';

type SeedUser = {
  name: string;
  email: string;
  password: string;
  roles: { role: string; state?: string; branch?: string }[];
  state?: string;
  branch?: string;
};

const HIERARCHY_USERS: SeedUser[] = [
  {
    name: 'Super Admin',
    email: 'superadmin@niti.gov.in',
    password: 'SuperAdmin@123',
    roles: [{ role: 'Super Admin' }],
  },
  {
    name: 'PMO',
    email: 'pmo@gov.in',
    password: 'PMO@1234',
    roles: [{ role: 'PMO' }],
  },
  {
    name: 'CEO – NITI Aayog',
    email: 'ceo.niti@gov.in',
    password: 'Ceo@1234',
    roles: [{ role: 'CEO NITI' }],
  },
  {
    name: 'State Advisor (UP)',
    email: 'advisor.up@gov.in',
    password: 'Advisor@123',
    roles: [{ role: 'State Advisor', state: 'Uttar Pradesh' }],
    state: 'Uttar Pradesh',
  },
  {
    name: 'State YP (UP)',
    email: 'yp.up@gov.in',
    password: 'YP@12345',
    roles: [{ role: 'State YP', state: 'Uttar Pradesh' }],
    state: 'Uttar Pradesh',
  },
  {
    name: 'State Division HOD (UP – Education)',
    email: 'hod.up.education@gov.in',
    password: 'HOD@1234',
    roles: [{ role: 'State Division HOD', state: 'Uttar Pradesh', branch: 'Education' }],
    state: 'Uttar Pradesh',
    branch: 'Education',
  },
  {
    name: 'Division YP (UP – Education)',
    email: 'yp.div.up@gov.in',
    password: 'DivYP@123',
    roles: [{ role: 'Division YP', state: 'Uttar Pradesh', branch: 'Education' }],
    state: 'Uttar Pradesh',
    branch: 'Education',
  },
];

export async function POST(req: NextRequest) {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not allowed in production' }, { status: 403 });
  }

  // Intentionally allow unauthenticated in dev for quick bootstrap
  await connectDB();
  if (isDevMode()) {
    clearDevUsers();
    const created: string[] = [];
    for (const u of HIERARCHY_USERS) {
      const passwordHash = await hashPassword(u.password);
      const doc = createDevUser({
        name: u.name,
        email: u.email,
        passwordHash,
        roles: u.roles,
        state: u.state,
        branch: u.branch,
        avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
      });
      if (doc) created.push(String(doc.id));
    }
    return NextResponse.json({ ok: true, cleared: { acknowledged: true }, createdCount: created.length });
  }

  const { acknowledged: clearedAck } = await User.deleteMany({});
  const created: string[] = [];
  for (const u of HIERARCHY_USERS) {
    const passwordHash = await hashPassword(u.password);
    const doc = await User.create({
      name: u.name,
      email: u.email,
      passwordHash,
      roles: u.roles,
      state: u.state,
      branch: u.branch,
    });
    created.push(String(doc._id));
  }
  return NextResponse.json({ ok: true, cleared: clearedAck, createdCount: created.length });
}
