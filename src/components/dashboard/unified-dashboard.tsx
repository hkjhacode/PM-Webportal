
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// switched from mock data to live API
import { Request, User, UserRoleAssignment } from '@/types';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import NewRequestDialog from '../requests/new-request-dialog';

type FilterType = 'all' | 'approvals' | 'allocations';

export default function UnifiedDashboard() {
  const { user, hasRole } = useAuth();
  const [taskFilter, setTaskFilter] = useState<FilterType>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');

  const userAssignments = useMemo(() => {
    if (!user) return { states: [], roles: [], divisions: [] };
    const states = new Set<string>();
    const roles = new Set<string>();
    const divisions = new Set<string>();
    user.roles.forEach(r => {
        roles.add(r.role);
        if (r.state) states.add(r.state);
        if (r.division) divisions.add(r.division);
    });
    return {
        states: ['all', ...Array.from(states)],
        roles: ['all', ...Array.from(roles)],
        divisions: ['all', ...Array.from(divisions)],
    }
  }, [user]);

  // Using live API, we don't resolve assignedBy names here; keep placeholder.
  const findAssignedByLabel = () => '—';

  const [items, setItems] = useState<Request[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/workflows', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const docs = await res.json();
        const mapStatus = (s: string): Request['status'] => {
          switch (s) {
            case 'approved':
              return 'Completed';
            case 'rejected':
              return 'Rejected';
            default:
              return 'Pending State YP';
          }
        };
        const toUiRequest = (doc: any): Request => {
          const due = doc.deadline || doc.timeline;
          const state = doc.targets?.states?.[0] || '';
          const division = doc.targets?.branches?.[0] || '';
          const auditTrail = (doc.history || []).map((h: any, i: number) => ({
            id: `${doc._id}-h-${i}`,
            timestamp: new Date(h.timestamp).toISOString(),
            userId: String(h.userId),
            action:
              h.action === 'create' || h.action === 'created'
                ? 'Created Request'
                : h.action === 'approve'
                ? 'Approved'
                : h.action === 'reject'
                ? 'Rejected'
                : h.action === 'forwarded'
                ? 'Forwarded'
                : h.action,
            notes: h.notes,
          }));
          return {
            id: String(doc._id),
            title: doc.title,
            description: doc.infoNeed,
            createdBy: String(doc.createdBy),
            createdAt: new Date(doc.createdAt).toISOString(),
            dueDate: due ? new Date(due).toISOString() : new Date().toISOString(),
            status: mapStatus(doc.status),
            currentAssigneeId: doc.currentAssigneeId ? String(doc.currentAssigneeId) : '',
            state,
            division,
            submittedData: undefined,
            auditTrail,
            flowDirection: doc.status === 'rejected' ? 'down' : 'up',
            assignedBy: String(doc.createdBy),
          };
        };
        setItems(Array.isArray(docs) ? docs.map(toUiRequest) : []);
      } catch (e) {
        setItems([]);
      }
    };
    load();
  }, []);

  const myTasks = useMemo(() => {
    if (!user) return [];
    
    return items.filter(r => {
        // Super Admin and CEO NITI can see everything if no filter is applied
        if ((hasRole('Super Admin') || hasRole('CEO NITI')) && stateFilter === 'all' && divisionFilter === 'all') {
             return true;
        }
        
        // Check if the request state matches the state filter
        if (stateFilter !== 'all' && r.state !== stateFilter) {
            return false;
        }

        // Check if the request division matches the division filter
        if (divisionFilter !== 'all' && r.division !== divisionFilter) {
            return false;
        }

        // Check if the current user is assigned this task based on their roles
        const isAssignee = r.currentAssigneeId === user.id;

        // If a role filter is applied, check if the user has that role for the request's context
        if (roleFilter !== 'all') {
            const hasMatchingRole = user.roles.some(assignment => 
                assignment.role === roleFilter &&
                (!assignment.state || assignment.state === r.state) &&
                (!assignment.division || assignment.division === r.division)
            );
            return isAssignee && hasMatchingRole;
        }
        
        return isAssignee;
    });

  }, [user, items, stateFilter, roleFilter, divisionFilter, hasRole]);

  const filteredTasks = useMemo(() => {
    return myTasks.filter(task => {
        if (taskFilter === 'all') return true;
        if (taskFilter === 'approvals') return task.flowDirection === 'up';
        if (taskFilter === 'allocations') return task.flowDirection === 'down';
        return true;
    });
  }, [myTasks, taskFilter]);

  const getStatusVariant = (status: Request['status']) => {
    switch (status) {
      case 'Completed':
        return 'default';
      case 'Rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getFlowVariant = (flow: Request['flowDirection']) => {
    return flow === 'up' ? 'default' : 'secondary';
  };

  const renderTaskList = (tasks: Request[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Request</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="hidden sm:table-cell">Assigned By</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          <TableHead className="hidden md:table-cell">Due Date</TableHead>
          <TableHead className="text-right"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length > 0 ? (
          tasks.map(request => (
            <TableRow key={request.id}>
              <TableCell>
                <div className="font-medium">{request.title}</div>
                <div className="hidden text-sm text-muted-foreground md:inline">
                  {request.state} - {request.division}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getFlowVariant(request.flowDirection)}>
                  {request.flowDirection === 'up'
                    ? 'Approval Required'
                    : 'Allocated Task'}
                </Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {findAssignedByLabel()}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge className="text-xs" variant={getStatusVariant(request.status)}>
                  {request.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {format(parseISO(request.dueDate), 'PPP')}
              </TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/requests/${request.id}`}>
                    View Details
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center">
              No tasks found for the selected filters.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>My Tasks</CardTitle>
            <CardDescription>
              A unified view of all your pending approvals and allocated tasks.
            </CardDescription>
          </div>
          {hasRole('CEO NITI') && <NewRequestDialog />}
        </div>
        <div className="flex flex-col md:flex-row gap-4 pt-4">
          <div className="flex-1">
            <Select value={taskFilter} onValueChange={value => setTaskFilter(value as FilterType)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Task Types</SelectItem>
                <SelectItem value="approvals">Approval Requests</SelectItem>
                <SelectItem value="allocations">Allocated Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={stateFilter} onValueChange={setStateFilter} disabled={userAssignments.states.length <= 1}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by State" />
              </SelectTrigger>
              <SelectContent>
                {userAssignments.states.map(state => (
                  <SelectItem key={state} value={state}>
                    {state === 'all' ? 'All States' : state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
           <div className="flex-1">
            <Select value={divisionFilter} onValueChange={setDivisionFilter} disabled={userAssignments.divisions.length <= 1}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Division" />
              </SelectTrigger>
              <SelectContent>
                {userAssignments.divisions.map(div => (
                  <SelectItem key={div} value={div}>
                    {div === 'all' ? 'All Divisions' : div}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={roleFilter} onValueChange={setRoleFilter} disabled={userAssignments.roles.length <= 1}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                {userAssignments.roles.map(role => (
                  <SelectItem key={role} value={role}>
                    {role === 'all' ? 'All Roles' : role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>{renderTaskList(filteredTasks)}</CardContent>
    </Card>
  );
}
