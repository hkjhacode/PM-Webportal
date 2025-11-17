import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles } from '@/lib/auth';
import { User } from '@/models/user';
import { DynamicFormTemplate } from '@/models/dynamic-form-template';
import { EnhancedWorkflowRequest } from '@/models/enhanced-workflow-request';
import { PMVisit } from '@/models/pm-visit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not allowed in production' }, { status: 403 });
  }

  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin', 'Admin'])) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  // Pick an admin user to own created docs
  const admin =
    user || (await User.findOne({ 'roles.role': { $in: ['Super Admin', 'Admin'] } })) || (await User.findOne({}));
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'No users found to assign ownership' }, { status: 400 });
  }

  // Ensure default dynamic form templates for different states and verticals
  const templateUpserts = [
    {
      name: 'Energy Data Collection Template',
      state: 'Andaman and Nicobar Islands',
      vertical: 'Energy',
      version: '1.0',
      isActive: true,
      createdBy: admin._id,
      sections: [
        {
          id: 'energy_basics',
          title: 'Basic Energy Information',
          order: 1,
          fields: [
            {
              id: 'total_capacity_mw',
              type: 'number',
              label: 'Total Power Generation Capacity (MW)',
              required: true,
              order: 1,
              validation: { min: 0 }
            },
            {
              id: 'renewable_share',
              type: 'number',
              label: 'Renewable Energy Share (%)',
              required: true,
              order: 2,
              validation: { min: 0, max: 100 }
            }
          ]
        }
      ],
      metadata: {
        estimatedCompletionTime: 30,
        requiredDocuments: ['Energy statistics report', 'Renewable energy policy document'],
        instructions: 'Please provide accurate energy data for the state.'
      }
    },
    {
      name: 'Healthcare Infrastructure Template',
      state: 'Andaman and Nicobar Islands',
      vertical: 'Healthcare',
      version: '1.0',
      isActive: true,
      createdBy: admin._id,
      sections: [
        {
          id: 'healthcare_facilities',
          title: 'Healthcare Facilities',
          order: 1,
          fields: [
            {
              id: 'total_hospitals',
              type: 'number',
              label: 'Total Number of Hospitals',
              required: true,
              order: 1,
              validation: { min: 0 }
            },
            {
              id: 'primary_health_centers',
              type: 'number',
              label: 'Primary Health Centers',
              required: true,
              order: 2,
              validation: { min: 0 }
            }
          ]
        }
      ],
      metadata: {
        estimatedCompletionTime: 25,
        requiredDocuments: ['Health department report', 'Infrastructure inventory'],
        instructions: 'Provide current healthcare infrastructure data.'
      }
    }
  ];

  const templates: any[] = [];
  for (const t of templateUpserts) {
    const existing = await DynamicFormTemplate.findOne({ state: t.state, vertical: t.vertical, version: t.version });
    if (existing) templates.push(existing);
    else templates.push(await DynamicFormTemplate.create(t));
  }

  // Create a demo PM Visit
  const pmVisit =
    (await PMVisit.findOne({ title: 'PM Visit to Andaman and Nicobar Islands' })) ||
    (await PMVisit.create({
      title: 'PM Visit to Andaman and Nicobar Islands',
      purpose: 'Review development progress and infrastructure projects',
      visitDate: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days from now
      state: 'Andaman and Nicobar Islands',
      verticals: ['Energy', 'Healthcare', 'Tourism'],
      finalDeadline: new Date(Date.now() + 25 * 24 * 3600 * 1000), // 5 days before visit
      createdBy: admin._id,
      status: 'draft',
      deadlines: [
        { role: 'Division YP', deadline: new Date(Date.now() + 15 * 24 * 3600 * 1000), status: 'pending' },
        { role: 'State Division HOD', deadline: new Date(Date.now() + 18 * 24 * 3600 * 1000), status: 'pending' },
        { role: 'State YP', deadline: new Date(Date.now() + 21 * 24 * 3600 * 1000), status: 'pending' },
        { role: 'State Advisor', deadline: new Date(Date.now() + 23 * 24 * 3600 * 1000), status: 'pending' },
        { role: 'CEO NITI', deadline: new Date(Date.now() + 25 * 24 * 3600 * 1000), status: 'pending' },
        { role: 'PMO', deadline: new Date(Date.now() + 25 * 24 * 3600 * 1000), status: 'pending' }
      ],
      auditLog: [{
        action: 'created',
        userId: admin._id,
        role: 'PMO',
        timestamp: new Date(),
        notes: 'Demo PM Visit created for Andaman and Nicobar Islands'
      }]
    }));

  return NextResponse.json({ ok: true, seeded: true, pmVisitId: pmVisit._id });
}