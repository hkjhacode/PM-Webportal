import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles } from '@/lib/auth';
import { PMVisit } from '@/models/pm-visit';
import { User } from '@/models/user';
import { EnhancedWorkflowRequest } from '@/models/enhanced-workflow-request';
import { addDays, addHours } from 'date-fns';
import { auditLogger } from '@/lib/audit-logger';

/**
 * PM Visit API Routes
 * Handles creation, management, and deadline cascade for PM visits
 */

const CreatePMVisitSchema = z.object({
  title: z.string().min(5).max(200),
  purpose: z.string().min(10).max(1000),
  visitDate: z.date(),
  state: z.string(),
  verticals: z.array(z.string()).min(1),
  finalDeadline: z.date(),
});

// Helper function to calculate cascade deadlines
function calculateCascadeDeadlines(visitDate: Date, finalDeadline: Date) {
  const deadlines = [];
  const timeDiff = finalDeadline.getTime() - visitDate.getTime();
  const dayDiff = timeDiff / (1000 * 3600 * 24);

  // Define deadline allocation for each role (in days before final deadline)
  const deadlineAllocations = {
    'PMO': 0, // Final deadline
    'CEO NITI': Math.max(2, dayDiff * 0.2), // 20% of time or minimum 2 days
    'State Advisor': Math.max(5, dayDiff * 0.4), // 40% of time or minimum 5 days
    'State YP': Math.max(8, dayDiff * 0.6), // 60% of time or minimum 8 days
    'State Division HOD': Math.max(12, dayDiff * 0.8), // 80% of time or minimum 12 days
    'Division YP': Math.max(15, dayDiff * 0.95), // 95% of time or minimum 15 days
  };

  const roles = ['Division YP', 'State Division HOD', 'State YP', 'State Advisor', 'CEO NITI', 'PMO'];
  
  return roles.map(role => ({
    role,
    deadline: new Date(finalDeadline.getTime() - (deadlineAllocations[role] * 24 * 3600 * 1000)),
    status: 'pending' as const,
  }));
}

// Helper function to find users for each role in the cascade
async function findUsersForRoles(state: string) {
  const roleHierarchy = ['PMO', 'CEO NITI', 'State Advisor', 'State YP', 'State Division HOD', 'Division YP'];
  const userAssignments = {};

  for (const role of roleHierarchy) {
    const query = role === 'PMO' || role === 'CEO NITI' 
      ? { 'roles.role': role }
      : { 'roles.role': role, 'roles.state': state };
    
    const user = await User.findOne(query);
    userAssignments[role] = user?._id || null;
  }

  return userAssignments;
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['PMO'])) {
    return NextResponse.json({ error: 'Forbidden: Only PMO can create PM visits' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreatePMVisitSchema.safeParse({
      ...body,
      visitDate: new Date(body.visitDate),
      finalDeadline: new Date(body.finalDeadline),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    await connectDB();

    const { title, purpose, visitDate, state, verticals, finalDeadline } = parsed.data;

    // Validate that final deadline is before visit date
    if (finalDeadline >= visitDate) {
      return NextResponse.json({ 
        error: 'Final deadline must be at least 1 day before the visit date' 
      }, { status: 400 });
    }

    // Calculate cascade deadlines
    const cascadeDeadlines = calculateCascadeDeadlines(visitDate, finalDeadline);
    
    // Find users for each role
    const userAssignments = await findUsersForRoles(state);
    
    // Assign users to deadlines
    const deadlinesWithAssignments = cascadeDeadlines.map(deadline => ({
      ...deadline,
      assignedUserId: userAssignments[deadline.role]
    }));

    // Create PM Visit
    const pmVisit = await PMVisit.create({
      title,
      purpose,
      visitDate,
      state,
      verticals,
      finalDeadline,
      deadlines: deadlinesWithAssignments,
      createdBy: user._id,
      status: 'draft',
      auditLog: [{
        action: 'created',
        userId: user._id,
        role: 'PMO',
        timestamp: new Date(),
        notes: `PM Visit created for ${state} with verticals: ${verticals.join(', ')}`,
      }]
    });

    await auditLogger.logPMVisitAction(
      'created',
      String(user._id),
      'PMO',
      String(pmVisit._id),
      {
        after: { title, state, verticals, visitDate, finalDeadline }
      },
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );

    return NextResponse.json({ 
      id: String(pmVisit._id),
      deadlines: deadlinesWithAssignments 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating PM Visit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const state = url.searchParams.get('state');
    const status = url.searchParams.get('status');

    if (id) {
      // Get single PM Visit
      const pmVisit = await PMVisit.findById(id)
        .populate('createdBy', 'name email')
        .populate('deadlines.assignedUserId', 'name email roles')
        .populate('workflowRequests');

      if (!pmVisit) {
        return NextResponse.json({ error: 'PM Visit not found' }, { status: 404 });
      }

      // Check permissions
      const userRoles = user.roles.map(r => r.role);
      const hasAccess = userRoles.includes('PMO') || 
                       userRoles.includes('CEO NITI') ||
                       (userRoles.includes('State Advisor') && pmVisit.state === user.roles.find(r => r.role === 'State Advisor')?.state);

      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json(pmVisit);
    }

    // Get list of PM Visits
    const query: any = {};
    
    // Filter by user's role and state access
    const userRoles = user.roles.map(r => r.role);
    
    if (userRoles.includes('PMO')) {
      // PMO can see all visits
    } else if (userRoles.includes('CEO NITI')) {
      // CEO NITI can see all visits
    } else if (userRoles.includes('State Advisor')) {
      const state = user.roles.find(r => r.role === 'State Advisor')?.state;
      if (state) query.state = state;
    } else {
      // Other roles can only see visits where they're assigned
      query['deadlines.assignedUserId'] = user._id;
    }

    if (state) query.state = state;
    if (status) query.status = status;

    const pmVisits = await PMVisit.find(query)
      .populate('createdBy', 'name email')
      .populate('deadlines.assignedUserId', 'name email')
      .sort({ visitDate: -1 })
      .limit(50);

    return NextResponse.json(pmVisits);

  } catch (error) {
    console.error('Error fetching PM Visits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, action, notes } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const pmVisit = await PMVisit.findById(id);
    if (!pmVisit) {
      return NextResponse.json({ error: 'PM Visit not found' }, { status: 404 });
    }

    // Check permissions based on action
    const userRoles = user.roles.map(r => r.role);
    
    if (action === 'activate' && !userRoles.includes('PMO')) {
      return NextResponse.json({ error: 'Only PMO can activate visits' }, { status: 403 });
    }

    if (action === 'complete' && !userRoles.includes('PMO')) {
      return NextResponse.json({ error: 'Only PMO can complete visits' }, { status: 403 });
    }

    let updateData: any = {};
    let auditEntry: any = {
      action,
      userId: user._id,
      role: userRoles[0],
      timestamp: new Date(),
      notes: notes || '',
    };

    switch (action) {
      case 'activate':
        if (pmVisit.status !== 'draft') {
          return NextResponse.json({ error: 'Can only activate draft visits' }, { status: 400 });
        }
        updateData.status = 'active';
        auditEntry.notes = `PM Visit activated for ${pmVisit.state}`;
        break;

      case 'complete':
        if (pmVisit.status !== 'active') {
          return NextResponse.json({ error: 'Can only complete active visits' }, { status: 400 });
        }
        updateData.status = 'completed';
        auditEntry.notes = `PM Visit completed for ${pmVisit.state}`;
        break;

      case 'cancel':
        if (pmVisit.status === 'completed') {
          return NextResponse.json({ error: 'Cannot cancel completed visits' }, { status: 400 });
        }
        updateData.status = 'cancelled';
        auditEntry.notes = `PM Visit cancelled for ${pmVisit.state}`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    updateData['$push'] = { auditLog: auditEntry };

    const updatedPMVisit = await PMVisit.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).populate('createdBy', 'name email');

    return NextResponse.json(updatedPMVisit);

  } catch (error) {
    console.error('Error updating PM Visit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}