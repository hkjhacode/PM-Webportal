'use client'

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlusCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "../ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { useRouter } from 'next/navigation'
import { useToast } from "@/hooks/use-toast"

export default function NewRequestDialog() {
    const router = useRouter();
    const [date, setDate] = React.useState<Date | undefined>()
    const [title, setTitle] = React.useState<string>('')
    const [description, setDescription] = React.useState<string>('')
    const [state, setState] = React.useState<string>('')
    const [division, setDivision] = React.useState<string>('')
    const { toast } = useToast()

    const handleCreateRequest = async () => {
        if (!date) {
            toast({ variant: 'destructive', title: 'Missing Due Date', description: 'Please pick a due date.' });
            return;
        }
        // API requires timeline at least 3 days in the future
        const now = new Date();
        const min = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
        if (date <= min) {
            toast({ variant: 'destructive', title: 'Due Date Too Soon', description: 'Pick a date at least 3 days ahead.' });
            return;
        }
        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title,
                    infoNeed: description,
                    timeline: date,
                    targets: { states: state ? [state] : [], branches: division ? [division] : [] },
                })
            });
            if (!res.ok) {
                let msg = `HTTP ${res.status}`;
                try { const j = await res.json(); if (j?.error) msg = typeof j.error === 'string' ? j.error : 'Failed to create'; } catch {}
                toast({ variant: 'destructive', title: 'Create Failed', description: msg });
                return;
            }
            const data = await res.json();
            toast({ title: 'Request Created', description: 'Assigned to the first actor in the chain.' });
            router.push(`/dashboard/requests/${data.id}`);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Network Error', description: e?.message || 'Unable to create request.' });
        }
    }

    return (
        <Dialog>
        <DialogTrigger asChild>
          <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Request</DialogTitle>
            <DialogDescription>
              Fill in the details below to initiate a new information request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input id="title" placeholder="Quarterly Report Analysis" className="col-span-3" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">
                Description
              </Label>
              <Textarea id="description" placeholder="Details about the request..." className="col-span-3" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="state" className="text-right">
                State
              </Label>
              <Input id="state" placeholder="e.g., Uttar Pradesh" className="col-span-3" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="division" className="text-right">
                Division
              </Label>
              <Input id="division" placeholder="e.g., Education" className="col-span-3" value={division} onChange={(e) => setDivision(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="due-date" className="text-right">
                Due Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal col-span-3",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateRequest}>Create Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
}
