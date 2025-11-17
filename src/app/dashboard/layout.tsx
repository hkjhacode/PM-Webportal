'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import Header from '@/components/dashboard/header';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AssistantSidebar } from '@/components/assistant/assistant-sidebar';
import { Bot } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isAssistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
        <div className="flex">
            <Sidebar>
                <SidebarHeader>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
                    <Icons.logo className="size-5" />
                    </Button>
                    <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                    <Icons.logo className="h-6 w-6" />
                    <span className="font-semibold text-lg">VisitWise</span>
                    </div>
                </div>
                </SidebarHeader>
                <SidebarContent>
                <SidebarNav />
                </SidebarContent>
                <SidebarFooter>
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setAssistantOpen(true)}>
                        <Bot className="h-4 w-4" />
                        <span className='group-data-[collapsible=icon]:hidden'>AI Assistant</span>
                    </Button>
                </SidebarFooter>
            </Sidebar>
             <AssistantSidebar isOpen={isAssistantOpen} onOpenChange={setAssistantOpen} />

            <SidebarInset>
                <Header />
                <main className="flex-1 p-0">{children}</main>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
