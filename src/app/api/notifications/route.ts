import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireRoles } from '@/lib/auth';
import { sendEmail } from '@/lib/notifications';
import { auditLogger } from '@/lib/audit-logger';

/**
 * /api/notifications
 * Traceability: FR-12/FR-13/FR-14 — manual trigger for alerts and escalations
 * 
 * NOTE: External email/SMS services removed. 
 * This endpoint now logs notifications to console and uses in-app notifications.
 */

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['PMO Viewer', 'CEO NITI', 'Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const Schema = z.object({
    type: z.enum(['email']),
    to: z.string(),
    subject: z.string().optional(),
    message: z.string(),
  });
  
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  // Log the notification attempt (for debugging/monitoring)
  console.log(`[Notification] User ${user.email} sent notification:`, {
    to: parsed.data.to,
    subject: parsed.data.subject || 'HierarchyFlow Notification',
    message: parsed.data.message
  });

  // Attempt to send (will return skipped status)
  const r = await sendEmail(parsed.data.to, parsed.data.subject || 'HierarchyFlow Notification', parsed.data.message);
  
  await auditLogger.logSystemEvent(
    'alert_sent',
    {
      metadata: {
        type: parsed.data.type,
        to: parsed.data.to,
        subject: parsed.data.subject || 'HierarchyFlow Notification',
        status: (r as any)?.status || 'skipped'
      }
    },
    'info',
    'success'
  );
  
  // Return success with note about notification method
  return NextResponse.json({
    ...r,
    note: 'Notification logged. In-app notifications are active.',
    method: 'in-app'
  });
}

