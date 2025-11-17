'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import dynamic from 'next/dynamic';
const ResponsiveContainer = dynamic<any>(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Users, 
  FileText,
  TrendingUp,
  Activity,
  Building2,
  ArrowRight
} from 'lucide-react';

interface PMVisit {
  _id: string;
  title: string;
  state: string;
  visitDate: string;
  deadlineCEO: string;
  deadlineAdvisor: string;
  deadlineYP: string;
  deadlineHOD: string;
  deadlineDivYP: string;
  status: 'draft' | 'active' | 'completed';
  verticals: string[];
  createdAt: string;
}

interface WorkflowRequest {
  _id: string;
  pmVisitId: string;
  title: string;
  state: string;
  vertical: string;
  status: 'pending' | 'approved' | 'rejected' | 'rollback';
  currentLevel: string;
  deadline: string;
  submittedAt: string;
  submittedBy: string;
  data?: any;
}

interface VerticalStats {
  vertical: string;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  overdueRequests: number;
  completionRate: number;
}

export default function StateAdvisorDashboard({ userState }: { userState: string }) {
  const [pmVisits, setPmVisits] = useState<PMVisit[]>([]);
  const [workflowRequests, setWorkflowRequests] = useState<WorkflowRequest[]>([]);
  const [verticalStats, setVerticalStats] = useState<VerticalStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<string>('all');

  useEffect(() => {
    fetchDashboardData();
  }, [userState]);

  const fetchDashboardData = async () => {
    try {
      const [visitsRes, requestsRes] = await Promise.all([
        fetch(`/api/pm-visits?state=${encodeURIComponent(userState)}`),
        fetch(`/api/enhanced-workflows?state=${encodeURIComponent(userState)}`)
      ]);

      const visitsData = await visitsRes.json();
      const requestsData = await requestsRes.json();

      setPmVisits(Array.isArray(visitsData) ? visitsData : (visitsData.visits || []));
      const reqs = Array.isArray(requestsData) ? requestsData : (requestsData.requests || []);
      setWorkflowRequests(reqs);

      // Compute vertical stats locally
      const statsMap: Record<string, { total: number; approved: number; pending: number; overdue: number } > = {};
      const now = new Date();
      reqs.forEach((r: any) => {
        const v = r.targets?.verticals?.[0] || r.vertical || 'General';
        const key = v;
        if (!statsMap[key]) statsMap[key] = { total: 0, approved: 0, pending: 0, overdue: 0 };
        statsMap[key].total += 1;
        if (r.status === 'approved') statsMap[key].approved += 1;
        if (r.status === 'open' || r.status === 'in-progress') {
          statsMap[key].pending += 1;
          const deadline = new Date(r.deadline || r.timeline);
          if (deadline < now) statsMap[key].overdue += 1;
        }
      });
      setVerticalStats(Object.entries(statsMap).map(([vertical, s]) => ({
        vertical,
        totalRequests: s.total,
        approvedRequests: s.approved,
        pendingRequests: s.pending,
        overdueRequests: s.overdue,
        completionRate: s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0
      })));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = useMemo(() => workflowRequests.filter(request => request.status === 'pending'), [workflowRequests]);

  const overdueRequests = useMemo(() => {
    const now = new Date();
    return workflowRequests.filter(request => {
      const deadline = new Date(request.deadline);
      return deadline < now && request.status === 'pending';
    });
  }, [workflowRequests]);

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return workflowRequests.filter(request => {
      const deadline = new Date(request.deadline);
      return deadline >= now && deadline <= tomorrow && request.status === 'pending';
    });
  }, [workflowRequests]);

  const getVerticalStatsChartData = () => {
    return verticalStats.map(stat => ({
      vertical: stat.vertical,
      completionRate: stat.completionRate,
      totalRequests: stat.totalRequests,
      pendingRequests: stat.pendingRequests
    }));
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/enhanced-workflows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, action: 'approve', notes: 'Approved by State Advisor' })
      });
      if (response.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/enhanced-workflows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, action: 'reject', notes: 'Rejected by State Advisor' })
      });
      if (response.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleRequestRollback = async (requestId: string) => {
    try {
      const response = await fetch(`/api/enhanced-workflows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, action: 'reject', notes: 'Rollback for corrections' })
      });
      if (response.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error rolling back request:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const chartData = useMemo(() => getVerticalStatsChartData(), [verticalStats]);

  return (
    <div className="p-6 space-y-6 bg-background text-foreground anim-fade anim-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">State Advisor Dashboard</h1>
          <p className="text-muted-foreground mt-1">{userState} State</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            Refresh Data
          </Button>
          <Button>
            <FileText className="w-4 h-4 mr-2" />
            New Submission
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PM Visits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmVisits.length}</div>
            <p className="text-xs text-muted-foreground">
              Active in {userState}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">
              {overdueRequests.length} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {verticalStats.length > 0 
                ? Math.round(verticalStats.reduce((sum, stat) => sum + stat.completionRate, 0) / verticalStats.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across verticals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Verticals</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verticalStats.length}</div>
            <p className="text-xs text-muted-foreground">
              In your state
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {overdueRequests.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Reviews</AlertTitle>
          <AlertDescription>
            {overdueRequests.length} requests are overdue and require immediate attention.
            <Button variant="link" className="ml-2 p-0 h-auto">
              View Details
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {upcomingDeadlines.length > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Upcoming Deadlines</AlertTitle>
          <AlertDescription>
            {upcomingDeadlines.length} requests have deadlines within the next 24 hours.
            <Button variant="link" className="ml-2 p-0 h-auto">
              Review
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vertical Performance</CardTitle>
            <CardDescription>Completion rates by vertical</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vertical" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="completionRate" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Status Distribution</CardTitle>
            <CardDescription>Current status of all requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {verticalStats.map(stat => (
                <div key={stat.vertical} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stat.vertical}</span>
                    <span className="text-muted-foreground">
                      {stat.approvedRequests}/{stat.totalRequests}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${stat.completionRate}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>Requests awaiting your approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No pending reviews at the moment.
              </p>
            ) : (
              pendingRequests.map(request => (
                <div key={request._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{request.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.vertical} • Submitted by {request.submittedBy}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deadline: {new Date(request.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectRequest(request._id)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestRollback(request._id)}
                    >
                      Rollback
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproveRequest(request._id)}
                    >
                      Approve
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
