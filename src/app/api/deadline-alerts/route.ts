import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { PMVisit } from '@/models/pm-visit';
import { EnhancedWorkflowRequest } from '@/models/enhanced-workflow-request';

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const overdueWorkflows = await EnhancedWorkflowRequest.countDocuments({
    status: { $in: ['open','in-progress'] },
    $expr: { $lt: [ { $ifNull: ['$deadline','$timeline'] }, now ] }
  });

  const upcomingWorkflows = await EnhancedWorkflowRequest.countDocuments({
    status: { $in: ['open','in-progress'] },
    $expr: {
      $and: [
        { $gte: [ { $ifNull: ['$deadline','$timeline'] }, now ] },
        { $lte: [ { $ifNull: ['$deadline','$timeline'] }, next24h ] }
      ]
    }
  });

  const activeVisits = await PMVisit.countDocuments({ status: 'active' });

  return NextResponse.json({ overdueWorkflows, upcomingWorkflows, activeVisits });
}