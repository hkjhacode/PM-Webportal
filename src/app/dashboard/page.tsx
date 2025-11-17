'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import PMODashboard from '@/components/dashboards/pmo-dashboard';
import CEODashboard from '@/components/dashboards/ceo-dashboard';
import StateAdvisorDashboard from '@/components/dashboards/state-advisor-dashboard';
import StateYPDashboard from '@/components/dashboards/state-yp-dashboard';
import DivisionHODDashboard from '@/components/dashboards/division-hod-dashboard';
import DivisionYPDashboard from '@/components/dashboards/division-yp-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && (user.roles || []).some(r => r.role === 'Super Admin')) {
      router.push('/dashboard/user-management');
    }
  }, [user, loading, router]);

  if (loading || !mounted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if ((user.roles || []).some(r => r.role === 'Super Admin')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderDashboard = () => {
    const rolePriority = ['PMO','CEO NITI','State Advisor','State YP','State Division HOD','Division YP'] as const;
    const roles = user.roles || [];
    const highest = rolePriority.find(r => roles.some(rr => rr.role === r));

    switch (highest) {
      case 'PMO':
        return <PMODashboard />;
      case 'CEO NITI':
        return <CEODashboard />;
      case 'State Advisor': {
        const state = roles.find(r => r.role === 'State Advisor')?.state || '';
        return <StateAdvisorDashboard userState={state} />;
      }
      case 'State YP': {
        const state = roles.find(r => r.role === 'State YP')?.state || '';
        return <StateYPDashboard userState={state} />;
      }
      case 'State Division HOD': {
        const r = roles.find(r => r.role === 'State Division HOD');
        return <DivisionHODDashboard userState={r?.state || ''} userDivision={r?.division || ''} />;
      }
      case 'Division YP': {
        const r = roles.find(r => r.role === 'Division YP');
        return <DivisionYPDashboard userState={r?.state || ''} userDivision={r?.division || ''} userId={user.id} />;
      }
      default:
        return (
          <Card className="max-w-md mx-auto mt-20">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Your roles do not have a mapped dashboard.
              </p>
              <Button onClick={() => router.push('/login')}>
                Return to Login
              </Button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderDashboard()}
    </div>
  );
}
