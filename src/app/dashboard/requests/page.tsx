'use client';

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
import { format } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type WorkflowRow = {
  _id: string;
  title: string;
  status: string;
  deadline?: string | Date;
  timeline?: string | Date;
  targets?: { states?: string[]; branches?: string[] };
};

export default function AllRequestsPage() {
  const [items, setItems] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/workflows', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(data);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const renderRows = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center">
            Loading...
          </TableCell>
        </TableRow>
      );
    }
    if (!items.length) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center">
            No requests found or unauthorized.
          </TableCell>
        </TableRow>
      );
    }
    return items.map((request) => {
      const state = request.targets?.states?.[0] || '-';
      const division = request.targets?.branches?.[0] || '-';
      const due = request.deadline || request.timeline;
      const dueDateStr = due ? format(new Date(due), 'PPP') : '-';
      return (
        <TableRow key={request._id}>
          <TableCell>
            <div className="font-medium">{request.title}</div>
            <div className="hidden text-sm text-muted-foreground md:inline">
              {division}
            </div>
          </TableCell>
          <TableCell className="hidden sm:table-cell">{state}</TableCell>
          <TableCell className="hidden sm:table-cell">
            <Badge className="text-xs" variant={getStatusVariant(request.status)}>
              {request.status}
            </Badge>
          </TableCell>
          <TableCell className="hidden md:table-cell">{dueDateStr}</TableCell>
          <TableCell className="text-right">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/requests/${request._id}`}>View Details</Link>
            </Button>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Requests</CardTitle>
        <CardDescription>
          A log of all information requests, past and present.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead className="hidden sm:table-cell">State</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Due Date</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
