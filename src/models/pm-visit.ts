import mongoose, { Schema, model, models } from 'mongoose';

/**
 * PM Visit Model
 * Traceability: PM Visit creation, deadline cascade, state-specific visits
 */
const DeadlineSchema = new Schema(
  {
    role: { type: String, required: true },
    deadline: { type: Date, required: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'completed', 'overdue'], default: 'pending' },
    completedAt: { type: Date },
  },
  { _id: false }
);

const PMVisitSchema = new Schema(
  {
    title: { type: String, required: true },
    purpose: { type: String, required: true, maxlength: 1000 },
    visitDate: { type: Date, required: true },
    state: { type: String, required: true },
    verticals: { type: [String], required: true }, // Array of verticals for this visit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    deadlines: { type: [DeadlineSchema], default: [] }, // Cascade deadlines for each role
    finalDeadline: { type: Date, required: true }, // PMO final deadline
    currentStage: { type: String, default: 'PMO' },
    workflowRequests: [{ type: Schema.Types.ObjectId, ref: 'WorkflowRequest' }],
    auditLog: {
      type: [
        new Schema(
          {
            action: { type: String, required: true },
            userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            role: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
            notes: { type: String },
            metadata: { type: Schema.Types.Mixed },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export type PMVisitDoc = mongoose.InferSchemaType<typeof PMVisitSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PMVisit = models.PMVisit || model('PMVisit', PMVisitSchema);