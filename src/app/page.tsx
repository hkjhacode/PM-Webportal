'use client';

import { LoginForm } from '@/components/auth/login-form';
import { Icons } from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      const isSuperAdmin = (user.roles || []).some(r => r.role === 'Super Admin');
      router.push(isSuperAdmin ? '/dashboard/user-management' : '/dashboard');
    }
  }, [user, router]);

  return (
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <Icons.logo className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">VisitWise</h1>
            </div>
            <p className="text-balance text-muted-foreground">
              Streamlining official visits and reporting.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
         <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
         <div className="flex items-center justify-center h-full">
            <Icons.logo className="h-64 w-64 text-primary/30" />
         </div>
      </div>
    </div>
  );
}
