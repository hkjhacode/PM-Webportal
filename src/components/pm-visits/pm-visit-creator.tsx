'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, MapPin, Target, Clock, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllStates, getPriorityVerticalsForState } from '@/lib/state-vertical-config';
import { format, addDays } from 'date-fns';

interface PMVisitFormData {
  title: string;
  purpose: string;
  visitDate: string;
  state: string;
  verticals: string[];
  finalDeadline: string;
}

export function PMVisitCreator() {
  const [formData, setFormData] = useState<PMVisitFormData>({
    title: '',
    purpose: '',
    visitDate: '',
    state: '',
    verticals: [],
    finalDeadline: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const states = getAllStates();
  const availableVerticals = formData.state ? getPriorityVerticalsForState(formData.state) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.purpose.trim() || !formData.visitDate || !formData.state || formData.verticals.length === 0 || !formData.finalDeadline) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields'
      });
      return;
    }

    // Validate that final deadline is before visit date
    const visitDate = new Date(formData.visitDate);
    const finalDeadline = new Date(formData.finalDeadline);
    
    if (finalDeadline >= visitDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Final deadline must be at least 1 day before the visit date'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/pm-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          purpose: formData.purpose,
          visitDate: formData.visitDate,
          state: formData.state,
          verticals: formData.verticals,
          finalDeadline: formData.finalDeadline
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: 'PM Visit created successfully with deadline cascade'
        });
        
        // Reset form
        setFormData({
          title: '',
          purpose: '',
          visitDate: '',
          state: '',
          verticals: [],
          finalDeadline: ''
        });
        
        // Show deadline cascade information
        if (result.deadlines) {
          console.log('Deadline cascade created:', result.deadlines);
        }
        
      } else {
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.error || 'Failed to create PM visit'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create PM visit'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addVertical = (vertical: string) => {
    if (!formData.verticals.includes(vertical)) {
      setFormData({
        ...formData,
        verticals: [...formData.verticals, vertical]
      });
    }
  };

  const removeVertical = (vertical: string) => {
    setFormData({
      ...formData,
      verticals: formData.verticals.filter(v => v !== vertical)
    });
  };

  const handleStateChange = (state: string) => {
    setFormData({
      ...formData,
      state,
      verticals: [] // Reset verticals when state changes
    });
  };

  const setSuggestedDeadline = () => {
    if (formData.visitDate) {
      const visitDate = new Date(formData.visitDate);
      const suggestedDeadline = addDays(visitDate, -3); // 3 days before visit
      setFormData({
        ...formData,
        finalDeadline: format(suggestedDeadline, 'yyyy-MM-dd')
      });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create PM Visit</h1>
        <p className="text-muted-foreground">
          Schedule a new Prime Minister visit with automatic deadline cascade
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Visit Details
            </CardTitle>
            <CardDescription>
              Basic information about the PM visit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Visit Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Infrastructure Development Review - Maharashtra"
                required
              />
            </div>

            <div>
              <Label htmlFor="purpose">Purpose *</Label>
              <Textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Describe the purpose and objectives of this PM visit..."
                rows={4}
                maxLength={1000}
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                {formData.purpose.length}/1000 characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="visitDate">Visit Date *</Label>
                <Input
                  id="visitDate"
                  type="date"
                  value={formData.visitDate}
                  onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>

              <div>
                <Label htmlFor="finalDeadline">Final Deadline *</Label>
                <div className="flex gap-2">
                  <Input
                    id="finalDeadline"
                    type="date"
                    value={formData.finalDeadline}
                    onChange={(e) => setFormData({ ...formData, finalDeadline: e.target.value })}
                    max={formData.visitDate ? format(addDays(new Date(formData.visitDate), -1), 'yyyy-MM-dd') : undefined}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={setSuggestedDeadline}
                    disabled={!formData.visitDate}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Must be before visit date
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Focus Areas
            </CardTitle>
            <CardDescription>
              Select the state and verticals for this visit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="state">State *</Label>
              <Select value={formData.state} onValueChange={handleStateChange}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.state && (
              <div>
                <Label>Priority Verticals *</Label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {availableVerticals.map((vertical) => (
                    <Button
                      key={vertical}
                      type="button"
                      variant={formData.verticals.includes(vertical) ? "default" : "outline"}
                      size="sm"
                      onClick={() => 
                        formData.verticals.includes(vertical) 
                          ? removeVertical(vertical) 
                          : addVertical(vertical)
                      }
                      className="justify-start"
                    >
                      <Target className="h-3 w-3 mr-2" />
                      {vertical}
                    </Button>
                  ))}
                </div>
                
                {formData.verticals.length > 0 && (
                  <div>
                    <Label>Selected Verticals</Label>
                    <div className="flex flex-wrap gap-2">
                      {formData.verticals.map((vertical) => (
                        <Badge key={vertical} variant="secondary" className="gap-1">
                          {vertical}
                          <button
                            type="button"
                            onClick={() => removeVertical(vertical)}
                            className="ml-1 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription>
            <strong>Deadline Cascade:</strong> Once created, this visit will automatically generate deadlines for each level of the hierarchy (PMO → CEO NITI → State Advisor → State YP → Division HOD → Division YP) with appropriate time allocations.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3 justify-end">
          <Button type="submit" disabled={isSubmitting} className="min-w-32">
            {isSubmitting ? 'Creating...' : 'Create PM Visit'}
          </Button>
        </div>
      </form>
    </div>
  );
}