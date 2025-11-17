'use client';
import { useEffect, useMemo, useState } from 'react';
import { Bot, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { askAI } from '@/ai/flows/assistant-flow';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '../ui/skeleton';

interface AssistantSidebarProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AssistantSidebar({ isOpen, onOpenChange }: AssistantSidebarProps) {
  const { user } = useAuth();
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; createdAt: number; messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: number }> }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeConversation = useMemo(() => conversations.find(c => c.id === activeId) || null, [conversations, activeId]);
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    const key = user ? `chat:${user.id}` : null;
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setConversations(parsed);
        if (parsed.length && !activeId) setActiveId(parsed[0].id);
      } catch {}
    }
    setLastUserId(user.id);
  }, [user]);

  useEffect(() => {
    const key = user ? `chat:${user.id}` : null;
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(conversations));
  }, [conversations, user]);

  useEffect(() => {
    if (!user && lastUserId) {
      try { localStorage.removeItem(`chat:${lastUserId}`); } catch {}
      setConversations([]);
      setActiveId(null);
      setLastUserId(null);
    }
  }, [user, lastUserId]);

  const handleAskAI = async () => {
    if (!prompt || !user) return;
    setIsLoading(true);
    const now = Date.now();
    let convId = activeId;
    if (!convId) {
      convId = crypto.randomUUID();
      const title = prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt;
      const newConv = { id: convId, title, createdAt: now, messages: [] };
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(convId);
    }
    setConversations((prev) => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, { role: 'user', content: prompt, createdAt: now }] } : c));
    try {
      const result = await askAI({ query: prompt, context: document.body.innerText });
      const ans = result.answer;
      setConversations((prev) => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, { role: 'assistant', content: ans, createdAt: Date.now() }] } : c));
      setPrompt('');
    } catch {
      setConversations((prev) => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, { role: 'assistant', content: 'Sorry, something went wrong while trying to get an answer.', createdAt: Date.now() }] } : c));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    if (!user) return;
    const id = crypto.randomUUID();
    const now = Date.now();
    const newConv = { id, title: 'New Chat', createdAt: now, messages: [] };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(id);
    setPrompt('');
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className={`w-[400px] sm:w-[540px] bg-background p-0 ${isOpen ? 'glow-border' : ''} anim-fade`} side="right">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot />
            AI Assistant 🤖
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-[calc(100vh-4.5rem)]">
            <div className="p-4 border-b flex items-center gap-2">
              <Button variant="secondary" onClick={handleNewChat}>New Conversation</Button>
              <select className="flex-1 border rounded px-2 py-1 bg-background" value={activeId || ''} onChange={(e) => setActiveId(e.target.value || null)}>
                <option value="">Select conversation</option>
                {conversations.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div className='flex-1 overflow-y-auto p-4 space-y-4'>
                {messages.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'p-3 border rounded-md bg-background' : 'p-3 border rounded-md bg-muted'}>
                    <div className="text-xs mb-1">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="p-4 border rounded-md bg-muted">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                )}
            </div>
            <div className="p-4 border-t bg-background space-y-4">
                <Textarea
                    placeholder="Ask the AI to analyze or modify the UI..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                />
                <Button onClick={handleAskAI} disabled={isLoading || !user} className="w-full">
                    <Send className="mr-2 h-4 w-4" />
                    {isLoading ? 'Thinking...' : 'Ask AI'}
                </Button>
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
