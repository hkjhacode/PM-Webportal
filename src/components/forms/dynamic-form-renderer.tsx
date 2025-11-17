'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileUpload } from '@/components/ui/file-upload';
import { Info, Upload, AlertCircle } from 'lucide-react';

interface DynamicFormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'file' | 'textarea' | 'checkbox' | 'radio';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    maxLength?: number;
    minLength?: number;
  };
  conditional?: {
    field: string;
    value: any;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  };
  section: string;
  order: number;
}

interface DynamicFormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: DynamicFormField[];
}

interface DynamicFormTemplate {
  id: string;
  name: string;
  state: string;
  vertical: string;
  version: string;
  sections: DynamicFormSection[];
  metadata?: {
    estimatedCompletionTime?: number;
    requiredDocuments?: string[];
    instructions?: string;
  };
}

interface DynamicFormRendererProps {
  template: DynamicFormTemplate;
  onSubmit: (data: Record<string, any>, files: Record<string, File[]>) => void;
  onSaveDraft?: (data: Record<string, any>, files: Record<string, File[]>) => void;
  isSubmitting?: boolean;
  initialData?: Record<string, any>;
  mode?: 'create' | 'edit';
}

export function DynamicFormRenderer({ 
  template, 
  onSubmit, 
  onSaveDraft, 
  isSubmitting = false,
  initialData = {},
  mode = 'create'
}: DynamicFormRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Initialize visible sections based on conditional fields
    updateVisibleSections(formData);
  }, []);

  const updateVisibleSections = (data: Record<string, any>) => {
    const visible = new Set<string>();
    
    template.sections.forEach(section => {
      const hasVisibleFields = section.fields.some(field => {
        if (!field.conditional) return true;
        return evaluateConditional(field.conditional, data);
      });
      
      if (hasVisibleFields) {
        visible.add(section.id);
      }
    });
    
    setVisibleSections(visible);
  };

  const evaluateConditional = (conditional: any, data: Record<string, any>): boolean => {
    const fieldValue = data[conditional.field];
    const conditionValue = conditional.value;
    
    switch (conditional.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      default:
        return true;
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    const newData = { ...formData, [fieldId]: value };
    setFormData(newData);
    updateVisibleSections(newData);
    
    // Clear error for this field
    if (errors[fieldId]) {
      const newErrors = { ...errors };
      delete newErrors[fieldId];
      setErrors(newErrors);
    }
  };

  const handleFileChange = (fieldId: string, uploadedFiles: File[]) => {
    setFiles({ ...files, [fieldId]: uploadedFiles });
  };

  const validateField = (field: DynamicFormField, value: any): string | null => {
    if (field.required && (value === undefined || value === null || value === '')) {
      return `${field.label} is required`;
    }

    if (field.validation) {
      if (field.validation.minLength && String(value).length < field.validation.minLength) {
        return `${field.label} must be at least ${field.validation.minLength} characters`;
      }
      
      if (field.validation.maxLength && String(value).length > field.validation.maxLength) {
        return `${field.label} must not exceed ${field.validation.maxLength} characters`;
      }
      
      if (field.validation.pattern && !new RegExp(field.validation.pattern).test(String(value))) {
        return `${field.label} format is invalid`;
      }
      
      if (field.validation.min && Number(value) < field.validation.min) {
        return `${field.label} must be at least ${field.validation.min}`;
      }
      
      if (field.validation.max && Number(value) > field.validation.max) {
        return `${field.label} must not exceed ${field.validation.max}`;
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    template.sections.forEach(section => {
      if (!visibleSections.has(section.id)) return;
      
      section.fields.forEach(field => {
        if (!field.conditional || evaluateConditional(field.conditional, formData)) {
          const error = validateField(field, formData[field.id]);
          if (error) {
            newErrors[field.id] = error;
          }
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData, files);
    }
  };

  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft(formData, files);
    }
  };

  const renderField = (field: DynamicFormField) => {
    if (field.conditional && !evaluateConditional(field.conditional, formData)) {
      return null;
    }

    const value = formData[field.id] || '';
    const error = errors[field.id];

    const commonProps = {
      id: field.id,
      placeholder: field.placeholder,
      required: field.required,
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': error ? `${field.id}-error` : undefined,
    };

    switch (field.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id} className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
            />
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id} className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value ? parseFloat(e.target.value) : null)}
            />
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id} className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              {...commonProps}
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              rows={4}
            />
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id} className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(val) => handleFieldChange(field.id, val)}>
              <SelectTrigger id={field.id}>
                <SelectValue placeholder={field.placeholder || "Select an option"} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option, index) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            <Label className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${index}`}
                    checked={Array.isArray(value) && value.includes(option)}
                    onCheckedChange={(checked) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      const newValues = checked
                        ? [...currentValues, option]
                        : currentValues.filter(v => v !== option);
                      handleFieldChange(field.id, newValues);
                    }}
                  />
                  <Label htmlFor={`${field.id}-${index}`} className="font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            <Label className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup value={value} onValueChange={(val) => handleFieldChange(field.id, val)}>
              {field.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${index}`} />
                  <Label htmlFor={`${field.id}-${index}`} className="font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="font-normal">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.id} className={field.required ? "font-semibold" : ""}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <FileUpload
              id={field.id}
              onFilesChange={(uploadedFiles) => handleFileChange(field.id, uploadedFiles)}
              accept="*/*"
              multiple={false}
              maxFiles={5}
              maxSize={10 * 1024 * 1024} // 10MB
            />
            {error && (
              <p id={`${field.id}-error`} className="text-sm text-red-500">{error}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {template.metadata?.instructions && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{template.metadata.instructions}</AlertDescription>
        </Alert>
      )}

      {template.metadata?.requiredDocuments && template.metadata.requiredDocuments.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Required Documents:</strong>
            <ul className="mt-2 list-disc list-inside">
              {template.metadata.requiredDocuments.map((doc, index) => (
                <li key={index}>{doc}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {template.sections
        .sort((a, b) => a.order - b.order)
        .map(section => (
          visibleSections.has(section.id) && (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {section.fields
                  .sort((a, b) => a.order - b.order)
                  .map(field => renderField(field))
                  .filter(Boolean)}
              </CardContent>
            </Card>
          )
        ))}

      <div className="flex gap-3 justify-end">
        {onSaveDraft && (
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
          >
            Save Draft
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : mode === 'edit' ? 'Update' : 'Submit'}
        </Button>
      </div>
    </form>
  );
}