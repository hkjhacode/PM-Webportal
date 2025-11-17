'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import dynamic from 'next/dynamic';
const ResponsiveContainer = dynamic<any>(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Users, 
  FileText,
  TrendingUp,
  Activity,
  Calendar
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
}

interface StateStats {
  state: string;
  totalVisits: number;
  completedVisits: number;
  pendingRequests: number;
  overdueRequests: number;
  preparednessScore: number;
}

export default function CEODashboard() {
  const [pmVisits, setPmVisits] = useState<PMVisit[]>([]);
  const [workflowRequests, setWorkflowRequests] = useState<WorkflowRequest[]>([]);
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>('all');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [visitsRes, requestsRes] = await Promise.all([
        fetch('/api/pm-visits'),
        fetch('/api/enhanced-workflows')
      ]);

      const visitsData = await visitsRes.json();
      const requestsData = await requestsRes.json();

      const visits = Array.isArray(visitsData) ? visitsData : (visitsData.visits || []);
      const reqs = Array.isArray(requestsData) ? requestsData : (requestsData.requests || []);
      setPmVisits(visits);
      setWorkflowRequests(reqs);

      // Compute simple per-state stats
      const map: Record<string, { totalVisits: number; completedVisits: number; pendingRequests: number; overdueRequests: number; preparednessScore: number } > = {};
      const now = new Date();
      visits.forEach((v: any) => {
        const s = v.state || 'Unknown';
        if (!map[s]) map[s] = { totalVisits: 0, completedVisits: 0, pendingRequests: 0, overdueRequests: 0, preparednessScore: 0 };
        map[s].totalVisits += 1;
        if (v.status === 'completed') map[s].completedVisits += 1;
      });
      reqs.forEach((r: any) => {
        const s = (r.targets?.states?.[0]) || 'Unknown';
        if (!map[s]) map[s] = { totalVisits: 0, completedVisits: 0, pendingRequests: 0, overdueRequests: 0, preparednessScore: 0 };
        if (r.status === 'open' || r.status === 'in-progress') {
          map[s].pendingRequests += 1;
          const deadline = new Date(r.deadline || r.timeline);
          if (deadline < now) map[s].overdueRequests += 1;
        }
      });
      const stats: any[] = Object.entries(map).map(([state, s]) => ({
        state,
        totalVisits: s.totalVisits,
        completedVisits: s.completedVisits,
        pendingRequests: s.pendingRequests,
        overdueRequests: s.overdueRequests,
        preparednessScore: s.totalVisits > 0 ? Math.round((s.completedVisits / s.totalVisits) * 100) : 0
      }));
      setStateStats(stats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const chartData = useMemo(() => {
    return stateStats.map(stat => ({
      state: stat.state,
      score: stat.preparednessScore,
      visits: stat.totalVisits,
      completed: stat.completedVisits
    }));
  }, [stateStats]);

  const verticalData = useMemo(() => {
    const verticalCount: Record<string, number> = {};
    workflowRequests.forEach(request => {
      const v = (request as any).vertical;
      if (v) {
        verticalCount[v] = (verticalCount[v] || 0) + 1;
      }
    });
    return Object.entries(verticalCount).map(([vertical, count]) => ({ name: vertical, value: count }));
  }, [workflowRequests]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  

  return (
    <div className="p-6 space-y-6 bg-background text-foreground anim-fade anim-slide-up">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">CEO NITI Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            Refresh Data
          </Button>
          <Button>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Visit
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PM Visits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pmVisits.length}</div>
            <p className="text-xs text-muted-foreground">
              +{pmVisits.filter(v => new Date(v.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflowRequests.filter(r => r.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {overdueRequests.length} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Preparedness</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stateStats.length > 0 
                ? Math.round(stateStats.reduce((sum, stat) => sum + stat.preparednessScore, 0) / stateStats.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all states
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active States</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stateStats.length}</div>
            <p className="text-xs text-muted-foreground">
              With active visits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {overdueRequests.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Requests</AlertTitle>
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
            <CardTitle>State Preparedness Scores</CardTitle>
            <CardDescription>Preparedness percentage by state</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="score" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vertical Distribution</CardTitle>
            <CardDescription>Active requests by vertical</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={verticalData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {verticalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent PM Visits</CardTitle>
          <CardDescription>Latest visits and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pmVisits.slice(0, 5).map(visit => (
              <div key={visit._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{visit.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {visit.state} • {visit.visitDate}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {visit.verticals.map(vertical => (
                      <Badge key={vertical} variant="secondary" className="text-xs">
                        {vertical}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={visit.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {visit.status}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
