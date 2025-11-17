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
  ArrowRight,
  ArrowLeft,
  UserPlus
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
  division?: string;
  status: 'pending' | 'approved' | 'rejected' | 'rollback';
  currentLevel: string;
  deadline: string;
  submittedAt: string;
  submittedBy: string;
  data?: any;
}

interface DivisionStats {
  division: string;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  overdueRequests: number;
  completionRate: number;
}

export default function StateYPDashboard({ userState }: { userState: string }) {
  const [pmVisits, setPmVisits] = useState<PMVisit[]>([]);
  const [workflowRequests, setWorkflowRequests] = useState<WorkflowRequest[]>([]);
  const [divisionStats, setDivisionStats] = useState<DivisionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');

  useEffect(() => {
    fetchDashboardData();
  }, [userState]);

  const fetchDashboardData = async () => {
    try {
      const [visitsRes, requestsRes, statsRes] = await Promise.all([
        fetch(`/api/pm-visits?state=${userState}`),
        fetch(`/api/enhanced-workflows?state=${userState}&currentLevel=yp`),
        fetch(`/api/state-yp-stats?state=${userState}`)
      ]);

      const visitsData = await visitsRes.json();
      const requestsData = await requestsRes.json();
      const statsData = await statsRes.json();

      setPmVisits(visitsData.visits || []);
      setWorkflowRequests(requestsData.requests || []);
      setDivisionStats(statsData.divisionStats || []);
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

  const getDivisionStatsChartData = () => {
    return divisionStats.map(stat => ({
      division: stat.division,
      completionRate: stat.completionRate,
      totalRequests: stat.totalRequests,
      pendingRequests: stat.pendingRequests
    }));
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/enhanced-workflows/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          comments: 'Approved by State YP',
          nextLevel: 'hod'
        })
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
      const response = await fetch(`/api/enhanced-workflows/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          comments: 'Rejected by State YP',
          reason: 'Needs revision'
        })
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
      const response = await fetch(`/api/enhanced-workflows/${requestId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason: 'Rollback requested for corrections',
          previousLevel: 'advisor'
        })
      });

      if (response.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error rolling back request:', error);
    }
  };

  const handleCreateDivisionUser = (division: string) => {
    // Navigate to user creation page with division pre-selected
    window.open(`/users/create?division=${division}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const chartData = useMemo(() => getDivisionStatsChartData(), [divisionStats]);

  return (
    <div className="p-6 space-y-6 bg-background text-foreground anim-fade anim-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">State YP Dashboard</h1>
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
              {divisionStats.length > 0 
                ? Math.round(divisionStats.reduce((sum, stat) => sum + stat.completionRate, 0) / divisionStats.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across divisions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Divisions</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{divisionStats.length}</div>
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
            <CardTitle>Division Performance</CardTitle>
            <CardDescription>Completion rates by division</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="division" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="completionRate" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Division Management</CardTitle>
            <CardDescription>Quick actions for divisions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {divisionStats.map(stat => (
                <div key={stat.division} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{stat.division}</p>
                    <p className="text-sm text-muted-foreground">
                      {stat.totalRequests} requests • {stat.completionRate}% complete
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateDivisionUser(stat.division)}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Add User
                  </Button>
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
                      {request.vertical} • {request.division} • Submitted by {request.submittedBy}
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
                      <ArrowLeft className="w-3 h-3 mr-1" />
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
