import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles, hashPassword } from '@/lib/auth';
import { User } from '@/models/user';
import { isDevMode, getAllDevUsers, updateDevUser, deleteDevUser } from '@/lib/dev-user-store';

/**
 * /api/users
 * Secure user management (Super Admin only): list, create, update roles, delete.
 * Traceability: FR-02 (RBAC), Admin tooling for user lifecycle.
 */

const RoleSchema = z.object({
  role: z.string().min(1),
  state: z.string().optional(),
  // Accept either branch or division from clients; normalize to branch.
  branch: z.string().optional(),
  division: z.string().optional(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(RoleSchema).optional().default([]),
  state: z.string().optional(),
  branch: z.string().optional(),
});

const UpdateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  roles: z.array(RoleSchema).optional(),
  state: z.string().optional(),
  branch: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await connectDB();
  if (isDevMode()) {
    const users = getAllDevUsers();
    return NextResponse.json(
      users.map((u) => ({
        id: String(u.id),
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        roles: (u.roles || []).map((r: any) => ({ role: r.role, state: r.state, branch: r.branch })),
        state: u.state,
        branch: u.branch,
      }))
    );
  }
  const users = await User.find({}).sort({ name: 1 }).limit(200);
  return NextResponse.json(
    users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      roles: (u.roles || []).map((r: any) => ({ role: r.role, state: r.state, branch: r.branch })),
      state: u.state,
      branch: u.branch,
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const data = parsed.data;
  await connectDB();
  const exists = await User.findOne({ email: data.email });
  if (exists) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  const passwordHash = await hashPassword(data.password);
  const roles = (data.roles || []).map((r) => ({ role: r.role, state: r.state, branch: r.branch || r.division }));
  const created = await User.create({
    name: data.name,
    email: data.email,
    passwordHash,
    roles,
    state: data.state,
    branch: data.branch,
  });
  return NextResponse.json({ id: String(created._id) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { id, name, roles, state, branch } = parsed.data;
  await connectDB();
  const update: any = {};
  if (name) update.name = name;
  if (typeof state !== 'undefined') update.state = state;
  if (typeof branch !== 'undefined') update.branch = branch;
  if (roles) update.roles = roles.map((r) => ({ role: r.role, state: r.state, branch: r.branch || r.division }));
  if (isDevMode()) {
    const devUpdated = updateDevUser(id, update);
    if (!devUpdated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const updated = await User.findByIdAndUpdate(id, update, { new: true });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await connectDB();
  if (isDevMode()) {
    const ok = deleteDevUser(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  const res = await User.findByIdAndDelete(id);
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

