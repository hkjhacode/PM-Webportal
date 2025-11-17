import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles } from '@/lib/auth';
import { CreateRequestSchema } from '@/lib/validation';
import { WorkflowRequest } from '@/models/request';
import { User } from '@/models/user';

/**
 * /api/workflows
 * Traceability: FR-04 (create), FR-05 (propagate), FR-06 (filter tasks), FR-07 (approve/reject)
 */

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['PMO Viewer', 'CEO NITI'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const json = await req.json();
  const parsed = CreateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { title, infoNeed, timeline, targets } = parsed.data;
  const now = new Date();
  const minDate = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  if (timeline <= minDate) {
    return NextResponse.json({ error: 'timeline must be at least 3 days in the future' }, { status: 400 });
  }
  await connectDB();
  const doc = await WorkflowRequest.create({
    title,
    infoNeed,
    timeline,
    deadline: new Date(timeline.getTime() - 3 * 24 * 3600 * 1000), // FR-12 default deadline
    createdBy: user!._id,
    targets,
    history: [{ action: 'created', userId: user!._id, timestamp: new Date(), notes: '' }],
  });
  // Initial assignment: forward to bottom-of-chain actor based on targets
  const targetState = targets.states[0];
  const targetBranch = (targets.branches || [])[0];
  const initialRole = targetBranch ? 'Division YP' : 'State YP';
  const initialAssignee = await User.findOne({
    roles: { $elemMatch: { role: initialRole, ...(targetState ? { state: targetState } : {}), ...(targetBranch ? { branch: targetBranch } : {}) } },
  });
  let forwardedTo = '';
  if (initialAssignee) {
    doc.currentAssigneeId = initialAssignee._id;
    forwardedTo = `${initialRole}${targetState ? `, ${targetState}` : ''}${targetBranch ? ` – ${targetBranch}` : ''}`;
  } else {
    // Fallback to State Advisor or CEO NITI
    const fallbackRole = targetState ? 'State Advisor' : 'CEO NITI';
    const fallbackAssignee = await User.findOne({
      roles: { $elemMatch: { role: fallbackRole, ...(targetState ? { state: targetState } : {}) } },
    });
    if (fallbackAssignee) {
      doc.currentAssigneeId = fallbackAssignee._id;
      forwardedTo = `${fallbackRole}${targetState ? `, ${targetState}` : ''}`;
    }
  }
  if (doc.currentAssigneeId) {
    doc.status = 'in-progress';
    doc.history.push({ action: 'forwarded', userId: user!._id, timestamp: new Date(), notes: forwardedTo });
    await doc.save();
  }
  return NextResponse.json({ id: String(doc._id) });
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const one = await WorkflowRequest.findById(id);
    if (!one) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(one);
  }
  const status = url.searchParams.get('status') || undefined;
  const state = url.searchParams.get('state') || undefined;
  const q: any = {};
  if (status) q.status = status;
  if (state) q['targets.states'] = state;
  const items = await WorkflowRequest.find(q).sort({ timeline: 1 }).limit(50);
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const UpdateSchema = z.object({ id: z.string(), action: z.enum(['approve', 'reject']), notes: z.string().max(1000).optional() });
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  const { id, action, notes } = parsed.data;
  await connectDB();
  const doc = await WorkflowRequest.findById(id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Only current assignee can act
  if (doc.currentAssigneeId && String(doc.currentAssigneeId) !== String(user!._id)) {
    return NextResponse.json({ error: 'Forbidden: not current assignee' }, { status: 403 });
  }
  doc.history.push({ action, userId: user!._id, timestamp: new Date(), notes });

  const APPROVAL_CHAIN = ['Division YP', 'Division HOD', 'State YP', 'State Advisor', 'CEO NITI'] as const;
  // Determine actor role in chain (first matching role)
  const userRoles = (user.roles || []).map((r: { role: string }) => r.role);
  const actorRole = APPROVAL_CHAIN.find((r) => userRoles.includes(r));
  const targetState = doc.targets.states[0];
  const targetBranch = (doc.targets.branches || [])[0];

  if (action === 'approve') {
    // Move up the chain
    const idx = actorRole ? APPROVAL_CHAIN.indexOf(actorRole) : -1;
    const nextRole = idx >= 0 ? APPROVAL_CHAIN[idx + 1] : undefined;
    if (!nextRole) {
      // CEO NITI approves -> terminal
      doc.status = 'approved';
      doc.currentAssigneeId = undefined as any;
    } else {
      const nextAssignee = await User.findOne({
        roles: { $elemMatch: { role: nextRole, ...(targetState ? { state: targetState } : {}), ...(targetBranch ? { branch: targetBranch } : {}) } },
      });
      if (nextAssignee) {
        doc.currentAssigneeId = nextAssignee._id;
        doc.status = 'in-progress';
        doc.history.push({ action: 'forwarded', userId: user!._id, timestamp: new Date(), notes: `${nextRole}${targetState ? `, ${targetState}` : ''}${targetBranch ? ` – ${targetBranch}` : ''}` });
      } else {
        // If next assignee missing, still mark as approved for simplicity
        doc.status = 'approved';
        doc.currentAssigneeId = undefined as any;
      }
    }
  } else {
    // Reject goes down the chain
    const idx = actorRole ? APPROVAL_CHAIN.indexOf(actorRole) : -1;
    const prevRole = idx > 0 ? APPROVAL_CHAIN[idx - 1] : undefined;
    if (!prevRole) {
      doc.status = 'rejected';
      doc.currentAssigneeId = undefined as any;
    } else {
      const prevAssignee = await User.findOne({
        roles: { $elemMatch: { role: prevRole, ...(targetState ? { state: targetState } : {}), ...(targetBranch ? { branch: targetBranch } : {}) } },
      });
      if (prevAssignee) {
        doc.currentAssigneeId = prevAssignee._id;
        doc.status = 'in-progress';
        doc.history.push({ action: 'forwarded', userId: user!._id, timestamp: new Date(), notes: `${prevRole}${targetState ? `, ${targetState}` : ''}${targetBranch ? ` – ${targetBranch}` : ''}` });
      } else {
        doc.status = 'rejected';
        doc.currentAssigneeId = undefined as any;
      }
    }
  }

  await doc.save();
  return NextResponse.json({ ok: true });
}
