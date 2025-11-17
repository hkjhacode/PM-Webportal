import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles } from '@/lib/auth';
import { EnhancedWorkflowRequest } from '@/models/enhanced-workflow-request';
import { User } from '@/models/user';
import { PMVisit } from '@/models/pm-visit';
import { auditLogger } from '@/lib/audit-logger';
import { sendEmail } from '@/lib/notifications';
import { DynamicFormTemplate } from '@/models/dynamic-form-template';

/**
 * Enhanced Workflow API Routes
 * Implements correct hierarchy: PMO → CEO → Advisor → YP → HOD → Div YP
 * With rollback support and version control
 */

const CreateWorkflowSchema = z.object({
  title: z.string().min(5).max(200),
  infoNeed: z.string().min(10).max(1000),
  timeline: z.date(),
  pmVisitId: z.string().optional(),
  targets: z.object({
    states: z.array(z.string()).min(1),
    branches: z.array(z.string()).optional(),
    verticals: z.array(z.string()).optional(),
  }),
});

// Correct hierarchy flow: PMO → CEO → Advisor → YP → HOD → Div YP
const HIERARCHY_CHAIN = ['PMO', 'CEO NITI', 'State Advisor', 'State YP', 'State Division HOD', 'Division YP'] as const;

type HierarchyRole = typeof HIERARCHY_CHAIN[number];

function getNextRole(currentRole: HierarchyRole): HierarchyRole | null {
  const currentIndex = HIERARCHY_CHAIN.indexOf(currentRole);
  return currentIndex < HIERARCHY_CHAIN.length - 1 ? HIERARCHY_CHAIN[currentIndex + 1] : null;
}

function getPreviousRole(currentRole: HierarchyRole): HierarchyRole | null {
  const currentIndex = HIERARCHY_CHAIN.indexOf(currentRole);
  return currentIndex > 0 ? HIERARCHY_CHAIN[currentIndex - 1] : null;
}

// Helper function to find user for a specific role and state
async function findUserForRole(role: HierarchyRole, state: string, branch?: string) {
  let query: any = {};
  
  if (role === 'PMO' || role === 'CEO NITI') {
    query = { 'roles.role': role };
  } else {
    query = {
      'roles.role': role,
      'roles.state': state
    };
    
    if (branch && (role === 'State Division HOD' || role === 'Division YP')) {
      query['roles.branch'] = branch;
    }
  }
  
  return await User.findOne(query);
}

// Helper function to determine user's role in hierarchy
function getUserHierarchyRole(user: any): HierarchyRole | null {
  const userRoles = user.roles?.map((r: any) => r.role) || [];
  
  // Find the highest role in the hierarchy that the user has
  for (const role of HIERARCHY_CHAIN) {
    if (userRoles.includes(role)) {
      return role;
    }
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['PMO', 'CEO NITI', 'State Advisor'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateWorkflowSchema.safeParse({
      ...body,
      timeline: new Date(body.timeline),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    await connectDB();

    const { title, infoNeed, timeline, pmVisitId, targets } = parsed.data;

    // Validate timeline is in the future
    if (timeline <= new Date()) {
      return NextResponse.json({ error: 'Timeline must be in the future' }, { status: 400 });
    }

    // If linked to PM Visit, validate it exists
    if (pmVisitId) {
      const pmVisit = await PMVisit.findById(pmVisitId);
      if (!pmVisit) {
        return NextResponse.json({ error: 'PM Visit not found' }, { status: 404 });
      }
    }

    // Determine starting stage based on user's role
    const userRole = getUserHierarchyRole(user);
    if (!userRole) {
      return NextResponse.json({ error: 'Invalid user role for workflow creation' }, { status: 403 });
    }

    // Find the next user in the chain (going down the hierarchy)
    const targetState = targets.states[0];
    const targetBranch = targets.branches?.[0];
    const nextRole = getNextRole(userRole);
    
    let currentAssigneeId = null;
    let currentStage = userRole;
    
    if (nextRole) {
      const nextUser = await findUserForRole(nextRole, targetState, targetBranch);
      if (nextUser) {
        currentAssigneeId = nextUser._id;
        currentStage = nextRole;
      }
    }

    // Create enhanced workflow request
    const workflowRequest = await EnhancedWorkflowRequest.create({
      title,
      infoNeed,
      timeline,
      pmVisitId,
      createdBy: user._id,
      status: currentAssigneeId ? 'in-progress' : 'open',
      targets,
      currentAssigneeId,
      currentStage,
      history: [{
        action: 'created',
        userId: user._id,
        userRole,
        timestamp: new Date(),
        fromStage: null,
        toStage: currentStage,
        notes: `Workflow created by ${userRole}`,
      }],
      version: 1,
      versionHistory: [],
      rollbackCount: 0,
    });

    await auditLogger.logWorkflowAction(
      'created',
      String(user._id),
      userRole,
      String(workflowRequest._id),
      {
        toStage: currentStage,
        notes: `Workflow created by ${userRole}`,
        metadata: { targets, pmVisitId }
      },
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );

    return NextResponse.json({ 
      id: String(workflowRequest._id),
      currentStage,
      currentAssigneeId 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating workflow:', error);
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
    const status = url.searchParams.get('status');
    const state = url.searchParams.get('state');

    if (id) {
      // Get single workflow request
      const workflow = await EnhancedWorkflowRequest.findById(id)
        .populate('createdBy', 'name email roles')
        .populate('currentAssigneeId', 'name email roles')
        .populate('pmVisitId', 'title visitDate state');

      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      // Check permissions
      const userRole = getUserHierarchyRole(user);
      const hasAccess = checkWorkflowAccess(user, workflow, userRole);
      
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json(workflow);
    }

    // Get list of workflow requests
    const query: any = {};
    
    // Filter by user's role and access level
    const userRole = getUserHierarchyRole(user);
    if (!userRole) {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 403 });
    }

    // Build role-based query
    const roleBasedQuery = buildRoleBasedQuery(user, userRole);
    Object.assign(query, roleBasedQuery);

    if (status) query.status = status;
    if (state) query['targets.states'] = state;

    const workflows = await EnhancedWorkflowRequest.find(query)
      .populate('createdBy', 'name email')
      .populate('currentAssigneeId', 'name email')
      .populate('pmVisitId', 'title visitDate state')
      .sort({ timeline: 1 })
      .limit(50);

    return NextResponse.json(workflows);

  } catch (error) {
    console.error('Error fetching workflows:', error);
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
    const { id, action, notes, data, newDeadline } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const workflow = await EnhancedWorkflowRequest.findById(id);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check if user is current assignee
    if (String(workflow.currentAssigneeId) !== String(user._id)) {
      return NextResponse.json({ error: 'Not current assignee' }, { status: 403 });
    }

    const userRole = getUserHierarchyRole(user);
    if (!userRole) {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 403 });
    }

    let updateData: any = {};
    let historyEntry: any = {
      action,
      userId: user._id,
      userRole,
      timestamp: new Date(),
      fromStage: workflow.currentStage,
      notes: notes || '',
    };

    switch (action) {
      case 'approve':
        if (userRole === 'State Advisor') {
          const currentDeadline = (workflow.deadline as any) || (workflow.timeline as any);
          if (newDeadline) {
            const nd = new Date(newDeadline);
            if (!isNaN(nd.getTime()) && currentDeadline && nd < new Date(currentDeadline)) {
              updateData.deadline = nd;
              historyEntry.notes = `${historyEntry.notes || ''}`.trim();
            }
          }
        }
        const nextRole = getNextRole(userRole);
        if (!nextRole) {
          // Final approval - mark as approved
          updateData.status = 'approved';
          updateData.currentAssigneeId = null;
          historyEntry.toStage = null;
        } else {
          // Forward to next role
          const targetState = workflow.targets.states[0];
          const targetBranch = workflow.targets.branches?.[0];
          if (userRole === 'State YP' && Array.isArray(workflow.targets.branches) && workflow.targets.branches.length > 1) {
            for (const b of workflow.targets.branches) {
              const hod = await findUserForRole('State Division HOD', targetState, b);
              if (hod) {
                await EnhancedWorkflowRequest.create({
                  title: workflow.title,
                  infoNeed: workflow.infoNeed,
                  timeline: workflow.timeline,
                  deadline: workflow.deadline,
                  pmVisitId: workflow.pmVisitId,
                  createdBy: workflow.createdBy,
                  status: 'in-progress',
                  targets: { states: workflow.targets.states, branches: [b], verticals: workflow.targets.verticals },
                  currentAssigneeId: hod._id,
                  currentStage: 'State Division HOD',
                  history: [{ action: 'forwarded', userId: user._id, userRole, timestamp: new Date(), fromStage: workflow.currentStage, toStage: 'State Division HOD', notes: b }],
                  version: 1,
                  versionHistory: [],
                  rollbackCount: 0,
                });
                if (hod.email) {
                  await sendEmail(hod.email, 'New workflow assignment', `${workflow.title}`);
                }
              }
            }
            updateData.currentAssigneeId = null;
            updateData.currentStage = workflow.currentStage;
            historyEntry.toStage = workflow.currentStage;
          } else {
            const nextUser = await findUserForRole(nextRole, targetState, targetBranch);
            
            if (nextUser) {
              updateData.currentAssigneeId = nextUser._id;
              updateData.currentStage = nextRole;
              historyEntry.toStage = nextRole;
              if (nextUser.email) {
                const dl = updateData.deadline || workflow.deadline || workflow.timeline;
                await sendEmail(nextUser.email, 'New workflow assignment', `${workflow.title}` + (dl ? ` | Due: ${new Date(dl).toLocaleString()}` : ''));
              }
            } else {
              updateData.status = 'approved';
              updateData.currentAssigneeId = null;
              historyEntry.toStage = null;
            }
          }
        }
        break;

      case 'reject':
        const prevRole = getPreviousRole(userRole);
        if (!prevRole) {
          return NextResponse.json({ error: 'Cannot reject at this level' }, { status: 400 });
        }

        // Send back to previous role
        const targetState = workflow.targets.states[0];
        const targetBranch = workflow.targets.branches?.[0];
        const prevUser = await findUserForRole(prevRole, targetState, targetBranch);
        
        if (prevUser) {
          updateData.currentAssigneeId = prevUser._id;
          updateData.currentStage = prevRole;
          updateData.rollbackCount = workflow.rollbackCount + 1;
          historyEntry.toStage = prevRole;
        } else {
          return NextResponse.json({ error: 'Previous user not found' }, { status: 400 });
        }
        break;

      case 'submit':
        // For Division YP to submit data
        if (userRole !== 'Division YP') {
          return NextResponse.json({ error: 'Only Division YP can submit data' }, { status: 403 });
        }

        if (!data) {
          return NextResponse.json({ error: 'Submission data required' }, { status: 400 });
        }

        {
          const state = workflow.targets.states[0];
          const vertical = (workflow.targets.verticals || [])[0];
          const tpl = await DynamicFormTemplate.findOne({ state, vertical, isActive: true });
          if (!tpl) {
            return NextResponse.json({ error: 'No active template for state and vertical' }, { status: 400 });
          }
        }

        // Save version history
        const newVersion = {
          version: workflow.version + 1,
          data: data,
          submittedBy: user._id,
          submittedAt: new Date(),
          status: 'submitted',
          notes: notes || 'Initial submission',
        };

        updateData.version = workflow.version + 1;
        updateData['$push'] = { versionHistory: newVersion };
        historyEntry.toStage = workflow.currentStage; // Stay at same stage for approval
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    updateData['$push'] = { ...updateData['$push'], history: historyEntry };

    const updatedWorkflow = await EnhancedWorkflowRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('currentAssigneeId', 'name email');

    await auditLogger.logWorkflowAction(
      (action as any),
      String(user._id),
      userRole,
      String(id),
      {
        fromStage: historyEntry.fromStage,
        toStage: historyEntry.toStage,
        notes: historyEntry.notes
      },
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );

    return NextResponse.json(updatedWorkflow);

  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
function checkWorkflowAccess(user: any, workflow: any, userRole: HierarchyRole | null): boolean {
  if (!userRole) return false;
  
  // PMO and CEO NITI can access all workflows
  if (userRole === 'PMO' || userRole === 'CEO NITI') return true;
  
  // State Advisor can access workflows for their state
  if (userRole === 'State Advisor') {
    const state = user.roles.find((r: any) => r.role === 'State Advisor')?.state;
    return state && workflow.targets.states.includes(state);
  }
  
  // Other roles can only access workflows they're assigned to
  return String(workflow.currentAssigneeId) === String(user._id);
}

function buildRoleBasedQuery(user: any, userRole: HierarchyRole): any {
  switch (userRole) {
    case 'PMO':
    case 'CEO NITI':
      return {}; // Can see all workflows
      
    case 'State Advisor':
      const state = user.roles.find((r: any) => r.role === 'State Advisor')?.state;
      return state ? { 'targets.states': state } : { 'targets.states': [] }; // Empty if no state
      
    default:
      return { currentAssigneeId: user._id }; // Can only see assigned workflows
  }
}