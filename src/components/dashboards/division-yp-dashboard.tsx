'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Edit3,
  Plus,
  Upload
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
  division: string;
  status: 'pending' | 'approved' | 'rejected' | 'rollback';
  currentLevel: string;
  deadline: string;
  submittedAt: string;
  submittedBy: string;
  data?: any;
}

interface MySubmission {
  _id: string;
  title: string;
  vertical: string;
  status: 'pending' | 'approved' | 'rejected' | 'rollback';
  submittedAt: string;
  deadline: string;
  currentLevel: string;
  pmVisitId: string;
}

export default function DivisionYPDashboard({ 
  userState, 
  userDivision,
  userId
}: { 
  userState: string;
  userDivision: string;
  userId: string;
}) {
  const [pmVisits, setPmVisits] = useState<PMVisit[]>([]);
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, [userState, userDivision, userId]);

  const fetchDashboardData = async () => {
    try {
      const [visitsRes, submissionsRes] = await Promise.all([
        fetch(`/api/pm-visits?state=${encodeURIComponent(userState)}`),
        fetch(`/api/enhanced-workflows`)
      ]);

      const visitsData = await visitsRes.json();
      const submissionsData = await submissionsRes.json();

      const visits = Array.isArray(visitsData) ? visitsData : (visitsData.visits || []);
      const reqs = Array.isArray(submissionsData) ? submissionsData : (submissionsData.requests || []);
      setPmVisits(visits);
      // Filter submissions by current user
      const mySubs = reqs.filter((r: any) => {
        const lastVersion = (r.versionHistory || []).slice(-1)[0];
        return lastVersion?.submittedBy && String(lastVersion.submittedBy) === String(userId);
      }).map((r: any) => ({
        _id: String(r._id),
        title: r.title,
        vertical: r.targets?.verticals?.[0] || 'General',
        status: r.status,
        submittedAt: (r.versionHistory || []).slice(-1)[0]?.submittedAt || r.createdAt,
        deadline: r.deadline || r.timeline,
        currentLevel: r.currentStage,
        pmVisitId: r.pmVisitId
      }));
      setMySubmissions(mySubs as any);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivePMVisits = () => {
    return pmVisits.filter(visit => visit.status === 'active');
  };

  const getMyPendingSubmissions = () => {
    return mySubmissions.filter(submission => submission.status === 'pending');
  };

  const getMyApprovedSubmissions = () => {
    return mySubmissions.filter(submission => submission.status === 'approved');
  };

  const getMyRejectedSubmissions = () => {
    return mySubmissions.filter(submission => submission.status === 'rejected');
  };

  const getUpcomingDeadlines = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return mySubmissions.filter(submission => {
      const deadline = new Date(submission.deadline);
      return deadline >= now && deadline <= tomorrow && submission.status === 'pending';
    });
  };

  const getOverdueSubmissions = () => {
    const now = new Date();
    
    return mySubmissions.filter(submission => {
      const deadline = new Date(submission.deadline);
      return deadline < now && submission.status === 'pending';
    });
  };

  const handleCreateSubmission = (pmVisitId: string, vertical: string) => {
    // Navigate to form submission page
    window.open(`/submissions/create?pmVisitId=${pmVisitId}&vertical=${vertical}`, '_blank');
  };

  const handleEditSubmission = (submissionId: string) => {
    // Navigate to edit submission page
    window.open(`/submissions/${submissionId}/edit`, '_blank');
  };

  const handleViewSubmission = (submissionId: string) => {
    // Navigate to view submission page
    window.open(`/submissions/${submissionId}`, '_blank');
  };

  const getSubmissionStats = () => {
    const total = mySubmissions.length;
    const approved = getMyApprovedSubmissions().length;
    const pending = getMyPendingSubmissions().length;
    const rejected = getMyRejectedSubmissions().length;
    
    return {
      total,
      approved,
      pending,
      rejected,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeVisits = getActivePMVisits();
  const pendingSubmissions = getMyPendingSubmissions();
  const approvedSubmissions = getMyApprovedSubmissions();
  const upcomingDeadlines = getUpcomingDeadlines();
  const overdueSubmissions = getOverdueSubmissions();
  const stats = getSubmissionStats();

  return (
    <div className="p-6 space-y-6 bg-background text-foreground anim-fade anim-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Division YP Dashboard</h1>
          <p className="text-muted-foreground mt-1">{userState} State • {userDivision} Division</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active PM Visits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVisits.length}</div>
            <p className="text-xs text-muted-foreground">
              In your state
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pending} pending • {stats.approved} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvalRate}%</div>
            <p className="text-xs text-muted-foreground">
              Success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueSubmissions.length}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {overdueSubmissions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Submissions</AlertTitle>
          <AlertDescription>
            {overdueSubmissions.length} submissions are overdue and need immediate attention.
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
            {upcomingDeadlines.length} submissions have deadlines within the next 24 hours.
            <Button variant="link" className="ml-2 p-0 h-auto">
              Review
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Active PM Visits */}
      <Card>
        <CardHeader>
          <CardTitle>Active PM Visits</CardTitle>
          <CardDescription>Current visits requiring your submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeVisits.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No active PM visits at the moment.
              </p>
            ) : (
              activeVisits.map(visit => (
                <div key={visit._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{visit.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {visit.state} • Visit Date: {new Date(visit.visitDate).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {visit.verticals.map(vertical => {
                        const hasSubmitted = mySubmissions.some(
                          sub => sub.vertical === vertical && sub.pmVisitId === visit._id
                        );
                        return (
                          <Badge 
                            key={vertical} 
                            variant={hasSubmitted ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {vertical}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/pm-visits/${visit._id}`, '_blank')}
                    >
                      View Details
                    </Button>
                    {visit.verticals.map(vertical => {
                      const hasSubmitted = mySubmissions.some(
                        sub => sub.vertical === vertical && sub.pmVisitId === visit._id
                      );
                      return !hasSubmitted ? (
                        <Button
                          key={vertical}
                          size="sm"
                          onClick={() => handleCreateSubmission(visit._id, vertical)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Submit {vertical}
                        </Button>
                      ) : null;
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* My Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Submissions</CardTitle>
            <CardDescription>Your submissions awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No pending submissions.
                </p>
              ) : (
                pendingSubmissions.map(submission => (
                  <div key={submission._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{submission.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {submission.vertical} • Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Deadline: {new Date(submission.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {submission.currentLevel}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewSubmission(submission._id)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your submission history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mySubmissions.slice(0, 5).map(submission => (
                <div key={submission._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{submission.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {submission.vertical} • {new Date(submission.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={
                        submission.status === 'approved' ? 'default' :
                        submission.status === 'rejected' ? 'destructive' :
                        submission.status === 'rollback' ? 'outline' :
                        'secondary'
                      }
                      className="text-xs"
                    >
                      {submission.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewSubmission(submission._id)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
