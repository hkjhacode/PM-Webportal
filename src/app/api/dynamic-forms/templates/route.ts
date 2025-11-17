import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { authenticateRequest, requireRoles } from '@/lib/auth';
import { DynamicFormTemplate } from '@/models/dynamic-form-template';
import { auditLogger } from '@/lib/audit-logger';

/**
 * Dynamic Form Template API Routes
 * Manages state+vertical specific form templates
 */

const FormFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'number', 'select', 'multiselect', 'file', 'textarea', 'checkbox', 'radio']),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
  }).optional(),
  conditional: z.object({
    field: z.string().optional(),
    value: z.any().optional(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']).optional(),
  }).optional(),
  section: z.string().optional(),
  order: z.number(),
});

const FormSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  order: z.number(),
  fields: z.array(FormFieldSchema),
});

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  state: z.string(),
  vertical: z.string(),
  version: z.string().default('1.0'),
  sections: z.array(FormSectionSchema).min(1),
  isActive: z.boolean().default(true),
  metadata: z.object({
    estimatedCompletionTime: z.number().optional(),
    requiredDocuments: z.array(z.string()).optional(),
    instructions: z.string().optional(),
  }).optional(),
});

const UpdateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  sections: z.array(FormSectionSchema).min(1).optional(),
  isActive: z.boolean().optional(),
  metadata: z.object({
    estimatedCompletionTime: z.number().optional(),
    requiredDocuments: z.array(z.string()).optional(),
    instructions: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!requireRoles(user, ['Super Admin'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = CreateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    await connectDB();

    const { name, state, vertical, version, sections, isActive, metadata } = parsed.data;

    // Check if a template already exists for this state+vertical+version combination
    const existing = await DynamicFormTemplate.findOne({ state, vertical, version });
    if (existing) {
      return NextResponse.json({ 
        error: 'Template already exists for this state, vertical, and version combination' 
      }, { status: 409 });
    }

    // Validate template structure
    const validationResult = validateTemplateStructure(sections);
    if (!validationResult.isValid) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 });
    }

    // Create template
    const template = await DynamicFormTemplate.create({
      name,
      state,
      vertical,
      version,
      sections: sections.sort((a, b) => a.order - b.order),
      isActive,
      createdBy: user._id,
      metadata: metadata || {},
    });

    await auditLogger.logFormTemplateAction(
      'created',
      String(user._id),
      user.roles?.[0]?.role || 'admin',
      String(template._id),
      {
        after: { name, state, vertical, version },
        metadata: {
          sectionsCount: template.sections.length,
          fieldsCount: template.sections.reduce((count, section) => count + section.fields.length, 0)
        }
      },
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );

    return NextResponse.json({
      id: String(template._id),
      name: template.name,
      state: template.state,
      vertical: template.vertical,
      version: template.version,
      sectionsCount: template.sections.length,
      fieldsCount: template.sections.reduce((count, section) => count + section.fields.length, 0),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating template:', error);
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
    const vertical = url.searchParams.get('vertical');
    const activeOnly = url.searchParams.get('active') !== 'false';

    if (id) {
      // Get single template
      const template = await DynamicFormTemplate.findById(id).populate('createdBy', 'name email');
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json(template);
    }

    // Build query
    const query: any = {};
    if (state) query.state = state;
    if (vertical) query.vertical = vertical;
    if (activeOnly) query.isActive = true;

    // If user is not Super Admin, only show templates for their accessible states
    const userRoles = user.roles?.map((r: any) => r.role) || [];
    if (!userRoles.includes('Super Admin')) {
      const accessibleStates = user.roles
        ?.filter((r: any) => r.state)
        .map((r: any) => r.state) || [];
      
      if (accessibleStates.length > 0) {
        query.state = { $in: accessibleStates };
      } else {
        query.state = { $in: [] }; // No access
      }
    }

    const templates = await DynamicFormTemplate.find(query)
      .populate('createdBy', 'name email')
      .sort({ state: 1, vertical: 1, version: -1 })
      .limit(50);

    return NextResponse.json(templates);

  } catch (error) {
    console.error('Error fetching templates:', error);
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
    const parsed = UpdateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    await connectDB();

    const { id, name, sections, isActive, metadata } = parsed.data;

    // Find existing template
    const existing = await DynamicFormTemplate.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Validate template structure if sections are being updated
    if (sections) {
      const validationResult = validateTemplateStructure(sections);
      if (!validationResult.isValid) {
        return NextResponse.json({ error: validationResult.error }, { status: 400 });
      }
    }

    // Update template
    const update: any = {};
    if (name) update.name = name;
    if (sections) update.sections = sections.sort((a, b) => a.order - b.order);
    if (typeof isActive !== 'undefined') update.isActive = isActive;
    if (metadata) update.metadata = { ...existing.metadata, ...metadata };

    const updated = await DynamicFormTemplate.findByIdAndUpdate(id, update, { new: true });

    await auditLogger.logFormTemplateAction(
      'updated',
      String(user._id),
      user.roles?.[0]?.role || 'admin',
      String(id),
      {
        after: { name: updated.name, state: existing.state, vertical: existing.vertical, version: existing.version },
        changes: Object.keys(update)
      },
      {
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined
      }
    );

    return NextResponse.json({
      id: String(updated._id),
      name: updated.name,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    });

  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to validate template structure
function validateTemplateStructure(sections: any[]): { isValid: boolean; error?: string } {
  try {
    const fieldIds = new Set<string>();
    const sectionIds = new Set<string>();

    for (const section of sections) {
      // Validate section
      if (!section.id || !section.title || typeof section.order !== 'number') {
        return { isValid: false, error: 'Invalid section structure' };
      }

      if (sectionIds.has(section.id)) {
        return { isValid: false, error: `Duplicate section ID: ${section.id}` };
      }
      sectionIds.add(section.id);

      // Validate fields
      if (!section.fields || !Array.isArray(section.fields)) {
        return { isValid: false, error: 'Invalid fields in section' };
      }

      for (const field of section.fields) {
        if (!field.id || !field.type || !field.label || typeof field.order !== 'number') {
          return { isValid: false, error: 'Invalid field structure' };
        }

        if (fieldIds.has(field.id)) {
          return { isValid: false, error: `Duplicate field ID: ${field.id}` };
        }
        fieldIds.add(field.id);

        // Validate field-specific requirements
        if (['select', 'multiselect', 'radio'].includes(field.type) && (!field.options || field.options.length === 0)) {
          return { isValid: false, error: `Field ${field.id} requires options` };
        }

        // Validate conditional logic
        if (field.conditional) {
          if (!field.conditional.field || field.conditional.operator === undefined) {
            return { isValid: false, error: `Invalid conditional logic for field ${field.id}` };
          }
        }
      }
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Template validation failed' };
  }
}