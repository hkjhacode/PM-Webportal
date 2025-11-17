import mongoose, { Schema, model, models } from 'mongoose';

/**
 * Enhanced WorkflowRequest Model
 * Supports rollback, version control, and enhanced audit trail
 */
const VersionHistorySchema = new Schema(
  {
    version: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, required: true },
    notes: { type: String },
    attachments: [{ 
      filename: { type: String, required: true },
      storageRef: { type: String },
      size: { type: Number }
    }]
  },
  { _id: false }
);

const EnhancedHistorySchema = new Schema(
  {
    action: { type: String, required: true, enum: ['created', 'submitted', 'approved', 'rejected', 'rollback', 'forwarded', 'deadline_extended'] },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, maxlength: 1000 },
    fromStage: { type: String },
    toStage: { type: String },
    version: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const TargetsSchema = new Schema(
  {
    states: { type: [String], default: [] },
    branches: { type: [String], default: [] },
    domains: { type: [String], default: [] },
    verticals: { type: [String], default: [] }
  },
  { _id: false }
);

const EnhancedWorkflowRequestSchema = new Schema(
  {
    title: { type: String, required: true },
    infoNeed: { type: String, required: true, maxlength: 1000 },
    timeline: { type: Date, required: true },
    deadline: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pmVisitId: { type: Schema.Types.ObjectId, ref: 'PMVisit' }, // Link to PM Visit
    status: {
      type: String,
      enum: ['open', 'in-progress', 'approved', 'rejected', 'closed', 'rollback'],
      default: 'open',
    },
    targets: { type: TargetsSchema, required: true },
    history: { type: [EnhancedHistorySchema], default: [] },
    currentAssigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    currentStage: { type: String, required: true, default: 'Division YP' },
    version: { type: Number, default: 1 },
    versionHistory: { type: [VersionHistorySchema], default: [] },
    rollbackCount: { type: Number, default: 0 },
    maxRollbackCount: { type: Number, default: 3 }, // Prevent infinite rollbacks
    deadlineAlerts: {
      type: [{
        alertType: { type: String, enum: ['reminder', 'overdue', 'escalation'] },
        sentAt: { type: Date, default: Date.now },
        recipientId: { type: Schema.Types.ObjectId, ref: 'User' },
        message: { type: String }
      }],
      default: []
    }
  },
  { timestamps: true }
);

// Add indexes for performance
EnhancedWorkflowRequestSchema.index({ pmVisitId: 1, status: 1 });
EnhancedWorkflowRequestSchema.index({ currentAssigneeId: 1, status: 1 });
EnhancedWorkflowRequestSchema.index({ timeline: 1 });

export type EnhancedWorkflowRequestDoc = mongoose.InferSchemaType<typeof EnhancedWorkflowRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EnhancedWorkflowRequest =
  models.EnhancedWorkflowRequest || model('EnhancedWorkflowRequest', EnhancedWorkflowRequestSchema);