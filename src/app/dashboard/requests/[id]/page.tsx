'use client';
import { RequestView } from "@/components/requests/request-view";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Request } from "@/types";

function toUiRequest(doc: any): Request {
  const due = doc.deadline || doc.timeline;
  const state = doc.targets?.states?.[0] || '';
  const division = doc.targets?.branches?.[0] || '';
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
}

export default function RequestPage({ params }: { params: { id: string } }) {
  const [req, setReq] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/enhanced-workflows?id=${params.id}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setReq(toUiRequest(data));
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      }
    };
    load();
  }, [params.id]);

  if (error || !req) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-semibold">{error ? 'Error Loading Request' : 'Request Not Found'}</h2>
        <p className="text-muted-foreground">{error || 'The request you are looking for does not exist.'}</p>
        <Link href="/dashboard" className="mt-4 inline-flex items-center text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <RequestView request={req} />;
}
