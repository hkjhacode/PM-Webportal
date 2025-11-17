import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles, hashPassword } from '@/lib/auth';
import { User } from '@/models/user';
import { isDevMode, getAllDevUsers, createDevUser, findDevUserByEmail, updateDevUser, findDevUserById } from '@/lib/dev-user-store';
import { generateUniqueUserCredentials, generateUserCredentials, maskCredentialsAfterTimeout } from '@/lib/user-credential-generator';
import { auditLogger } from '@/lib/audit-logger';

/**
 * Enhanced User Management API
 * Supports auto-generated credentials with 30-second display
 */

const RoleSchema = z.object({
  role: z.string().min(1),
  state: z.string().optional(),
  branch: z.string().optional(),
  division: z.string().optional(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roles: z.array(RoleSchema).optional().default([]),
  state: z.string().optional(),
  branch: z.string().optional(),
  autoGenerateCredentials: z.boolean().default(true),
});

const UpdateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  roles: z.array(RoleSchema).optional(),
  state: z.string().optional(),
  branch: z.string().optional(),
  resetPassword: z.boolean().optional(),
});

// Store temporary credentials (in production, use Redis or similar)
const tempCredentialsStore = new Map<string, { credentials: any, expiresAt: number }>();

// Cleanup expired credentials every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of tempCredentialsStore.entries()) {
    if (value.expiresAt <= now) {
      tempCredentialsStore.delete(key);
    }
  }
}, 300000);

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  await connectDB();
  
  const url = new URL(req.url);
  const tempId = url.searchParams.get('tempCredentials');
  
  // Return temporary credentials if requested
  if (tempId) {
    const tempData = tempCredentialsStore.get(tempId);
    if (tempData && tempData.expiresAt > Date.now()) {
      return NextResponse.json(tempData.credentials);
    } else {
      tempCredentialsStore.delete(tempId);
      return NextResponse.json({ error: 'Credentials expired' }, { status: 404 });
    }
  }
  
  // Regular user list
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
        createdAt: new Date(u.createdAt).toISOString(),
        updatedAt: new Date(u.updatedAt).toISOString(),
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
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    
    if (!parsed.success) {
      const fallbackName = typeof body?.name === 'string' ? body.name : null;
      if (fallbackName && isDevMode()) {
        const created = createDevUser({
          name: fallbackName,
          email: '',
          passwordHash: '',
          roles: [],
          state: undefined,
          branch: undefined,
          avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
        });
        if (created) {
          return NextResponse.json({
            id: String(created.id),
            name: created.name,
            email: created.email,
            roles: created.roles,
            message: 'User created without credentials. Assign roles to generate credentials.',
          }, { status: 201 });
        }
      }
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }
    
    await connectDB();
    
    const { name, email, password, roles, state, branch, autoGenerateCredentials } = parsed.data;
    
    let finalEmail = email;
    let finalPassword = password;
    let generatedCredentials = null;
    
    // If no roles provided, still generate credentials to satisfy DB constraints
    if ((roles || []).length === 0) {
      const existingEmails = isDevMode()
        ? getAllDevUsers().map(u => u.email).filter(Boolean)
        : (await User.find({}, { email: 1 })).map(u => (u as any).email);
      const gen = generateUniqueUserCredentials(name, existingEmails);
      const hash = await hashPassword(gen.password);
      if (isDevMode()) {
        const created = createDevUser({
          name,
          email: gen.email,
          passwordHash: hash,
          roles: [],
          state,
          branch,
          avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
        });
        if (!created) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = Date.now() + 30000;
        tempCredentialsStore.set(tempId, {
          credentials: { email: gen.email, password: gen.password, displayText: gen.displayText, expiresAt },
          expiresAt,
        });
        setTimeout(() => tempCredentialsStore.delete(tempId), 30000);
        return NextResponse.json({
          id: String(created.id),
          name: created.name,
          email: created.email,
          roles: created.roles,
          tempCredentialsId: tempId,
          message: 'User created. Credentials available for 30 seconds.',
        }, { status: 201 });
      } else {
        const created = await User.create({
          name,
          email: gen.email,
          passwordHash: hash,
          roles: [],
          state,
          branch,
          avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
        });
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = Date.now() + 30000;
        tempCredentialsStore.set(tempId, {
          credentials: { email: gen.email, password: gen.password, displayText: gen.displayText, expiresAt },
          expiresAt,
        });
        setTimeout(() => tempCredentialsStore.delete(tempId), 30000);
        return NextResponse.json({
          id: String(created._id),
          name: created.name,
          email: created.email,
          roles: created.roles,
          tempCredentialsId: tempId,
          message: 'User created. Credentials available for 30 seconds.',
        }, { status: 201 });
      }
    }

    // Auto-generate credentials if requested or if not provided
    if (autoGenerateCredentials || !email || !password) {
      const existingEmails = isDevMode()
        ? getAllDevUsers().map(u => u.email).filter(Boolean)
        : (await User.find({}, { email: 1 })).map(u => (u as any).email);
      generatedCredentials = generateUniqueUserCredentials(name, existingEmails);
      finalEmail = generatedCredentials.email;
      finalPassword = generatedCredentials.password;
    } else {
      generatedCredentials = {
        email: finalEmail!,
        password: finalPassword!,
        displayText: `Email: ${finalEmail} | Password: ${finalPassword}`
      };
    }
    
    if (isDevMode()) {
      const existsDev = findDevUserByEmail(finalEmail!);
      if (existsDev) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      }
    } else {
      const exists = await User.findOne({ email: finalEmail });
      if (exists) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      }
    }
    
    // Hash password
    if (!finalPassword || !finalEmail) {
      return NextResponse.json({ error: 'Internal error: missing credentials after generation' }, { status: 500 });
    }
    const passwordHash = await hashPassword(finalPassword as string);
    
    const normalizedRoles = roles.map((r) => ({
      role: r.role === 'Division HOD' ? 'State Division HOD' : r.role,
      state: r.state,
      branch: r.branch || r.division,
    }));
    
    // Enforce uniqueness for roles
    for (const r of normalizedRoles) {
      const role = r.role;
      const stateScope = r.state;
      const branchScope = r.branch;
      let query: any = { 'roles.role': role };
      if (role === 'PMO' || role === 'CEO NITI') {
        // Global unique
      } else if (role === 'State Advisor' || role === 'State YP') {
        query['roles.state'] = stateScope;
      } else if (role === 'State Division HOD' || role === 'Division YP') {
        query['roles.state'] = stateScope;
        query['roles.branch'] = branchScope;
      }
      if (isDevMode()) {
        const holder = getAllDevUsers().find(u => (u.roles || []).some((rr) => {
          if (rr.role !== role) return false;
          if (role === 'PMO' || role === 'CEO NITI') return true;
          if (role === 'State Advisor' || role === 'State YP') return rr.state === stateScope;
          if (role === 'State Division HOD' || role === 'Division YP') return rr.state === stateScope && rr.branch === branchScope;
          return false;
        }));
        if (holder) {
          return NextResponse.json({ error: `Role already assigned`, holder: { id: String(holder.id), name: holder.name, email: holder.email } }, { status: 409 });
        }
      } else {
        const holder = await User.findOne(query);
        if (holder) {
          return NextResponse.json({ error: `Role already assigned`, holder: { id: String(holder._id), name: holder.name, email: holder.email } }, { status: 409 });
        }
      }
    }

    let created: any;
    if (isDevMode()) {
      created = createDevUser({
        name,
        email: finalEmail!,
        passwordHash,
        roles: normalizedRoles,
        state,
        branch,
        avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
      });
      if (!created) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      }
    } else {
      created = await User.create({
        name,
        email: finalEmail!,
        passwordHash,
        roles: normalizedRoles,
        state,
        branch,
        avatarUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
        credentialSourceRole: normalizedRoles[0],
        credentialLockedAt: new Date(),
      });
    }
    
    // Store credentials temporarily for 30 seconds
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + 30000; // 30 seconds
    
    tempCredentialsStore.set(tempId, {
      credentials: {
        email: finalEmail as string,
        password: finalPassword as string,
        displayText: (generatedCredentials as any).displayText,
        expiresAt,
      },
      expiresAt,
    });
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      tempCredentialsStore.delete(tempId);
    }, 30000);

    await auditLogger.logUserAction(
      'created',
      String(user._id),
      user.roles?.[0]?.role || 'admin',
      String(created._id),
      {
        after: { name: created.name, email: finalEmail },
        roles: normalizedRoles.map(r => r.role),
        metadata: { state, branch, autoGeneratedCredentials: autoGenerateCredentials }
      },
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );
    
    return NextResponse.json({
      id: String(created._id || created.id),
      name: created.name,
      email: created.email,
      roles: created.roles,
      tempCredentialsId: tempId,
      message: 'User created successfully. Credentials will be available for 30 seconds.',
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const body = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }
    
    const { id, name, roles, state, branch, resetPassword } = parsed.data;
    await connectDB();
    
    const update: any = {};
    if (name) update.name = name;
    if (typeof state !== 'undefined') update.state = state;
    if (typeof branch !== 'undefined') update.branch = branch;
    if (roles) {
      const normalized = roles.map((r) => ({ role: r.role === 'Division HOD' ? 'State Division HOD' : r.role, state: r.state, branch: r.branch || r.division }));
      // Uniqueness checks per role assignment
      for (const r of normalized) {
        const role = r.role;
        const stateScope = r.state;
        const branchScope = r.branch;
        let query: any = { 'roles.role': role };
        if (role === 'PMO' || role === 'CEO NITI') {
          // Global unique
        } else if (role === 'State Advisor' || role === 'State YP') {
          query['roles.state'] = stateScope;
        } else if (role === 'State Division HOD' || role === 'Division YP') {
          query['roles.state'] = stateScope;
          query['roles.branch'] = branchScope;
        }
        if (isDevMode()) {
          const holder = getAllDevUsers().find(u => (u.roles || []).some((rr) => {
            if (rr.role !== role) return false;
            if (role === 'PMO' || role === 'CEO NITI') return true;
            if (role === 'State Advisor' || role === 'State YP') return rr.state === stateScope;
            if (role === 'State Division HOD' || role === 'Division YP') return rr.state === stateScope && rr.branch === branchScope;
            return false;
          }));
          if (holder && String(holder.id) !== String(id)) {
            return NextResponse.json({ error: `Role already assigned`, holder: { id: String(holder.id), name: holder.name, email: holder.email } }, { status: 409 });
          }
        } else {
          const holder = await User.findOne(query);
          if (holder && String(holder._id) !== String(id)) {
            return NextResponse.json({ error: `Role already assigned`, holder: { id: String(holder._id), name: holder.name, email: holder.email } }, { status: 409 });
          }
        }
      }
      update.roles = normalized;
    }
    
    // Handle password reset with 30s temp display
    if (resetPassword) {
      const { generateSecurePassword } = await import('@/lib/user-credential-generator');
      const newPassword = generateSecurePassword(12);
      const newHash = await (await import('@/lib/auth')).hashPassword(newPassword);
      if (isDevMode()) {
        const devTarget = findDevUserById(id);
        if (!devTarget) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const updated = updateDevUser(id, { passwordHash: newHash });
        if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = Date.now() + 30000;
        tempCredentialsStore.set(tempId, {
          credentials: {
            email: updated.email,
            password: newPassword,
            displayText: `Email: ${updated.email} | Password: ${newPassword}`,
            expiresAt,
          },
          expiresAt,
        });
        setTimeout(() => tempCredentialsStore.delete(tempId), 30000);
        return NextResponse.json({ ok: true, tempCredentialsId: tempId });
      } else {
        const target = await User.findById(id);
        if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        target.passwordHash = newHash;
        await target.save();
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = Date.now() + 30000;
        tempCredentialsStore.set(tempId, {
          credentials: {
            email: target.email,
            password: newPassword,
            displayText: `Email: ${target.email} | Password: ${newPassword}`,
            expiresAt,
          },
          expiresAt,
        });
        setTimeout(() => tempCredentialsStore.delete(tempId), 30000);
        return NextResponse.json({ ok: true, tempCredentialsId: tempId });
      }
    }

    if (isDevMode()) {
      // If assigning roles and user has no credentials, generate once
      const devTarget = getAllDevUsers().find(u => String(u.id) === String(id));
      if (!devTarget) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const needsCreds = !devTarget.email || !devTarget.passwordHash;
      const devUpdated = updateDevUser(id, update);
      if (!devUpdated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (needsCreds && (devUpdated.roles || []).length > 0) {
        const existingEmails = getAllDevUsers().map(u => u.email).filter(Boolean);
        const gen = generateUniqueUserCredentials(devUpdated.name, existingEmails);
        const hash = await (await import('@/lib/auth')).hashPassword(gen.password);
        updateDevUser(id, { email: gen.email, passwordHash: hash });
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = Date.now() + 30000;
        tempCredentialsStore.set(tempId, {
          credentials: { email: gen.email, password: gen.password, displayText: gen.displayText, expiresAt },
          expiresAt,
        });
        setTimeout(() => tempCredentialsStore.delete(tempId), 30000);
        return NextResponse.json({ 
          id: String(devUpdated.id),
          name: devUpdated.name,
          email: devUpdated.email,
          roles: devUpdated.roles,
          tempCredentialsId: tempId,
          message: 'Roles assigned. Credentials generated and available for 30 seconds.'
        });
      }
      return NextResponse.json({ 
        id: String(devUpdated.id),
        name: devUpdated.name,
        email: devUpdated.email,
        roles: devUpdated.roles,
        message: 'User updated successfully'
      });
    }

    const updated = await User.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // If assigning roles and user has no credentials in DB, generate once
    if ((!updated.email || !updated.passwordHash) && (updated.roles || []).length > 0) {
      const existingEmails = (await User.find({}, { email: 1 })).map(u => (u as any).email);
      const gen = generateUniqueUserCredentials(updated.name, existingEmails);
      const hash = await (await import('@/lib/auth')).hashPassword(gen.password);
      updated.email = gen.email;
      (updated as any).passwordHash = hash;
      const firstRole = (updated.roles || [])[0];
      (updated as any).credentialSourceRole = firstRole as any;
      (updated as any).credentialLockedAt = new Date();
      await updated.save();
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = Date.now() + 30000;
      tempCredentialsStore.set(tempId, {
        credentials: { email: gen.email, password: gen.password, displayText: gen.displayText, expiresAt },
        expiresAt,
      });
      setTimeout(() => tempCredentialsStore.delete(tempId), 30000);
      return NextResponse.json({ 
        id: String(updated._id),
        name: updated.name,
        email: updated.email,
        roles: updated.roles,
        tempCredentialsId: tempId,
        message: 'Roles assigned. Credentials generated and available for 30 seconds.'
      });
    }

    // Fallback mechanism: if credential source role was removed or revised, rebase email to base pattern
    if ((updated.roles || []).length >= 0 && (updated as any).credentialSourceRole) {
      const src: any = (updated as any).credentialSourceRole;
      const stillHas = (updated.roles || []).some((rr: any) => rr.role === src.role && rr.state === src.state && rr.branch === src.branch);
      if (!stillHas) {
        const existingEmails = (await User.find({}, { email: 1 })).map(u => (u as any).email);
        let base = generateUserCredentials(updated.name).email;
        let unique = base;
        let c = 1;
        while (existingEmails.includes(unique) && unique !== updated.email) {
          const local = base.split('@')[0];
          const domain = process.env.EMAIL_DOMAIN || 'gov.in';
          unique = `${local}${c}@${domain}`;
          c++;
        }
        updated.email = unique;
        await updated.save();
      }
    }
    return NextResponse.json({ 
      id: String(updated._id),
      name: updated.name,
      email: updated.email,
      roles: updated.roles,
      message: 'User updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    
    await connectDB();
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    return NextResponse.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
