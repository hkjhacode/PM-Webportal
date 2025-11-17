import mongoose, { Schema, model, models } from 'mongoose';

/**
 * Dynamic Form Template Model
 * Supports state+vertical specific forms with conditional logic
 */
const FormFieldSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['text', 'number', 'select', 'multiselect', 'file', 'textarea', 'checkbox', 'radio'],
      required: true 
    },
    label: { type: String, required: true },
    placeholder: { type: String },
    required: { type: Boolean, default: false },
    options: [{ type: String }], // For select/multiselect/radio
    validation: {
      min: { type: Number },
      max: { type: Number },
      pattern: { type: String },
      maxLength: { type: Number },
      minLength: { type: Number }
    },
    conditional: {
      field: { type: String }, // Field to watch
      value: { type: Schema.Types.Mixed }, // Value to match
      operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'] }
    },
    section: { type: String }, // Group fields into sections
    order: { type: Number, required: true }
  },
  { _id: false }
);

const FormSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    order: { type: Number, required: true },
    fields: { type: [FormFieldSchema], required: true }
  },
  { _id: false }
);

const DynamicFormTemplateSchema = new Schema(
  {
    name: { type: String, required: true },
    state: { type: String, required: true },
    vertical: { type: String, required: true },
    version: { type: String, required: true, default: '1.0' },
    sections: { type: [FormSectionSchema], required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: {
      estimatedCompletionTime: { type: Number }, // minutes
      requiredDocuments: [{ type: String }],
      instructions: { type: String }
    }
  },
  { timestamps: true }
);

// Create compound index for state+vertical+version uniqueness
DynamicFormTemplateSchema.index({ state: 1, vertical: 1, version: 1 }, { unique: true });

export type DynamicFormTemplateDoc = mongoose.InferSchemaType<typeof DynamicFormTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DynamicFormTemplate = models.DynamicFormTemplate || model('DynamicFormTemplate', DynamicFormTemplateSchema);