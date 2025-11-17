import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EnhancedWorkflowRequest } from '@/models/enhanced-workflow-request';
import { PMVisit } from '@/models/pm-visit';

/**
 * /api/analytics
 * Traceability: FR-17/FR-18 — dashboards and exports (MVP aggregates)
 */

export async function GET() {
  await connectDB();
  const totalWorkflowRequests = await EnhancedWorkflowRequest.countDocuments();
  const totalPMVisits = await PMVisit.countDocuments();
  const activePMVisits = await PMVisit.countDocuments({ status: 'active' });
  const overdueWorkflows = await EnhancedWorkflowRequest.countDocuments({ 
    'timeline': { $lt: new Date() }, 
    'status': { $nin: ['approved', 'rejected'] } 
  });
  return NextResponse.json({ 
    totalWorkflowRequests, 
    totalPMVisits, 
    activePMVisits, 
    overdueWorkflows 
  });
}

