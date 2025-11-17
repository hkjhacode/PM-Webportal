'use client';
import { Request } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { format, parseISO } from "date-fns";
import { AuditTrail } from "./audit-trail";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Paperclip, Send, ThumbsDown, ThumbsUp, Lightbulb, FileWarning } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { generateBriefingNotes } from "@/ai/flows/generate-briefing-notes";
import { detectDataInconsistencies } from "@/ai/flows/data-inconsistency-detection";
import { Skeleton } from "../ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

interface RequestViewProps {
    request: Request;
}

export function RequestView({ request }: RequestViewProps) {
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const [briefingNote, setBriefingNote] = useState<string | null>(null);
    const [inconsistencyReport, setInconsistencyReport] = useState<string | null>(null);
    const [summary, setSummary] = useState<string | null>(null);

    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [isInconsistencyLoading, setIsInconsistencyLoading] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [actionNotes, setActionNotes] = useState<string>('');
    const [isActing, setIsActing] = useState<boolean>(false);
    
    const isAssignee = user?.id === request.currentAssigneeId;

    useEffect(() => {
        const generateSummary = async () => {
            if (request.submittedData?.text) {
                setIsSummaryLoading(true);
                try {
                    const result = await generateBriefingNotes({ consolidatedReport: request.submittedData.text });
                    setSummary(result.briefingNote);
                } catch (error) {
                    // Fail silently
                    console.error("Failed to generate summary:", error);
                } finally {
                    setIsSummaryLoading(false);
                }
            }
        };
        generateSummary();
    }, [request.submittedData?.text]);


    const handleAction = async (action: 'submit' | 'approve' | 'reject') => {
        const effectiveAction = action === 'submit' ? 'approve' : action;
        setIsActing(true);
        try {
            const res = await fetch('/api/workflows', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: request.id, action: effectiveAction, notes: actionNotes || undefined })
            });
            if (!res.ok) {
                let msg = `HTTP ${res.status}`;
                try {
                    const j = await res.json();
                    if (j?.error) msg = typeof j.error === 'string' ? j.error : 'Action failed';
                } catch {}
                toast({ variant: 'destructive', title: 'Action failed', description: msg });
                return;
            }
            toast({
                title: effectiveAction === 'approve' ? 'Approved & Forwarded' : 'Rejected',
                description: effectiveAction === 'approve' ? 'Moved to the next level in the chain.' : 'Sent back down the chain.',
            });
            // Reload the page to reflect new assignee/status
            setTimeout(() => {
                if (typeof window !== 'undefined') window.location.reload();
            }, 300);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Network error', description: e?.message || 'Unable to perform action.' });
        } finally {
            setIsActing(false);
        }
    };

    const handleGenerateBriefing = async () => {
        setIsBriefingLoading(true);
        setBriefingNote(null);
        try {
            const result = await generateBriefingNotes({ consolidatedReport: request.submittedData?.text || "No data submitted." });
            setBriefingNote(result.briefingNote);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate briefing notes.' });
        } finally {
            setIsBriefingLoading(false);
        }
    };
    
    const handleDetectInconsistencies = async () => {
        setIsInconsistencyLoading(true);
        setInconsistencyReport(null);
        try {
            const result = await detectDataInconsistencies({ consolidatedReport: request.submittedData?.text || "No data submitted." });
            setInconsistencyReport(result.summary);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to detect inconsistencies.' });
        } finally {
            setIsInconsistencyLoading(false);
        }
    };

    const getStatusVariant = (status: Request['status']) => {
        switch (status) {
            case 'Completed': return 'default';
            case 'Rejected': return 'destructive';
            default: return 'secondary';
        }
    };
    
    const renderActionPanel = () => {
        if (!isAssignee || request.status === 'Completed' || request.status === 'Rejected') {
            return null;
        }

        if (hasRole('Division YP') || hasRole('State YP')) {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Submit Information</CardTitle>
                        <CardDescription>Please provide the requested information and attach relevant files.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Accordion type="multiple" className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>1. Health and Demographic Indicators</AccordionTrigger>
                                <AccordionContent className="grid grid-cols-2 gap-4">
                                    <Input placeholder="Total population (in million)" />
                                    <Input placeholder="Decadal Growth (%)" />
                                    <Input placeholder="Population density (per sq. km.)" />
                                    <Input placeholder="Projected Total Population '000" />
                                    <Input placeholder="Sex Ratio at Birth" />
                                    <Input placeholder="Total Fertility Rate" />
                                    <Input placeholder="Birth rate" />
                                    <Input placeholder="Death Rate" />
                                    <Input placeholder="Maternal Mortality Ratio" />
                                    <Input placeholder="Infant Mortality Rate" />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger>2. Health Infrastructure (Rural)</AccordionTrigger>
                                <AccordionContent className="grid grid-cols-4 gap-2 text-sm text-center">
                                    <Label className="text-left">Particulars</Label><Label>Required</Label><Label>In position</Label><Label>Shortfall</Label>
                                    <Label className="text-left font-normal pt-2">Sub-Centre</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                    <Label className="text-left font-normal pt-2">Primary Health Centre</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                    <Label className="text-left font-normal pt-2">Community Health Centre</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3">
                                <AccordionTrigger>3. Health-Human Resource (Rural)</AccordionTrigger>
                                <AccordionContent className="grid grid-cols-4 gap-2 text-sm text-center">
                                    <Label className="text-left">Particulars</Label><Label>Required</Label><Label>In position</Label><Label>Shortfall</Label>
                                    <Label className="text-left font-normal pt-2">Health Worker (Female)/ANM</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                    <Label className="text-left font-normal pt-2">Health Worker (Male)</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                    <Label className="text-left font-normal pt-2">Doctors at PHCs</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                    <Label className="text-left font-normal pt-2">Total specialists at CHCs</Label><Input type="number" /><Input type="number" /><Input type="number" />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-5">
                                <AccordionTrigger>5. Salient Features of Physical Progress under NHM</AccordionTrigger>
                                <AccordionContent className="space-y-2">
                                    <Input placeholder="ASHA in position with drug kits (Rural)" />
                                    <Input placeholder="ASHA in position with drug kits (Urban)" />
                                    <Input placeholder="ASHAs in position received 6th and 7th Module training - Rural" />
                                    <Input placeholder="ASHAs in position trained in 6th & 7th Module - Urban" />
                                    <Input placeholder="Sub-Centre without ANM" />
                                    <Input placeholder="Sub Centre is functional with Second ANM" />
                                    <Input placeholder="PHCs functioning on 24x7 basis" />
                                    <Input placeholder="CHCs functioning on 24x7 basis" />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-6">
                                <AccordionTrigger>6. Financial Progress under NRHM</AccordionTrigger>
                                <AccordionContent className="grid grid-cols-4 gap-2 text-sm text-center">
                                    <Label className="text-left">Year</Label><Label>Allocation (by GOI)</Label><Label>Release (by GOI)</Label><Label>Expenditure (by State)</Label>
                                    <Input placeholder="2015-23" /><Input type="number" placeholder="Rs. In Crore" /><Input type="number" placeholder="Rs. In Crore" /><Input type="number" placeholder="Rs. In Crore" />
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-7">
                                <AccordionTrigger>7. Centrally Sponsored Scheme: AB-PMJAY</AccordionTrigger>
                                <AccordionContent className="space-y-2">
                                    <Input placeholder="Issued Ayushman Cards" />
                                    <Input placeholder="Total Empanelled Hospitals" />
                                    <Input placeholder="Total number of Authorised Hospital Admissions till date" />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="pt-4 space-y-4">
                            <Textarea placeholder="Type your overall summary report here..." rows={4} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
                             <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="files">Attach Files</Label>
                                <Input id="files" type="file" multiple />
                             </div>
                             <div className="flex gap-2">
                                <Button onClick={() => handleAction('submit')} disabled={isActing || !isAssignee}>
                                    <Send className="mr-2 h-4 w-4" /> Submit for Approval
                                </Button>
                             </div>
                        </div>
                    </CardContent>
                </Card>
            );
        }

        // Approval roles
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Review & Action</CardTitle>
                    <CardDescription>Review the submitted data and approve or reject.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Textarea placeholder="Add optional notes..." rows={3} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
                     <div className="flex gap-2">
                        <Button onClick={() => handleAction('approve')} className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isActing || !isAssignee}>
                            <ThumbsUp className="mr-2 h-4 w-4" /> Approve & Forward
                        </Button>
                        <Button onClick={() => handleAction('reject')} variant="destructive" disabled={isActing || !isAssignee}>
                            <ThumbsDown className="mr-2 h-4 w-4" /> Reject
                        </Button>
                     </div>
                </CardContent>
            </Card>
        );
    };

    const renderAIPanels = () => {
        if (!request.submittedData) return null;

        return (
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>AI-Powered Briefing</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleGenerateBriefing} disabled={isBriefingLoading}>
                            <Lightbulb className="mr-2 h-4 w-4" /> {isBriefingLoading ? 'Generating...' : 'Generate Briefing Note'}
                        </Button>
                        {isBriefingLoading && <div className="mt-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
                        {briefingNote && <p className="mt-4 p-4 border rounded-md bg-muted text-sm">{briefingNote}</p>}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>AI Data Inconsistency Check</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleDetectInconsistencies} disabled={isInconsistencyLoading} variant="secondary">
                            <FileWarning className="mr-2 h-4 w-4" /> {isInconsistencyLoading ? 'Analyzing...' : 'Detect Inconsistencies'}
                        </Button>
                        {isInconsistencyLoading && <div className="mt-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
                        {inconsistencyReport && <p className="mt-4 p-4 border rounded-md bg-muted text-sm">{inconsistencyReport}</p>}
                    </CardContent>
                </Card>
            </>
        )
    }

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 grid gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl">{request.title}</CardTitle>
                                <CardDescription>Request ID: {request.id}</CardDescription>
                            </div>
                            <Badge variant={getStatusVariant(request.status)}>{request.status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="font-semibold">State:</span> {request.state}</div>
                            <div><span className="font-semibold">Division:</span> {request.division}</div>
                            <div><span className="font-semibold">Created:</span> {format(parseISO(request.createdAt), 'PPP')}</div>
                            <div><span className="font-semibold">Due:</span> {format(parseISO(request.dueDate), 'PPP')}</div>
                        </div>
                        <Separator />
                        <p className="text-muted-foreground">{request.description}</p>
                    </CardContent>
                </Card>

                {request.submittedData && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Submitted Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isSummaryLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            ) : (
                                summary && (
                                    <div className="mb-4 p-3 border rounded-md bg-muted/50 text-sm">
                                        <p className="font-semibold text-primary mb-2">AI Summary</p>
                                        <p className="text-muted-foreground">{summary}</p>
                                    </div>
                                )
                            )}
                            <p className="whitespace-pre-wrap">{request.submittedData.text}</p>
                            {request.submittedData.files && request.submittedData.files.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-semibold mb-2">Attached Files:</h4>
                                    <ul className="space-y-2">
                                        {request.submittedData.files.map(file => (
                                            <li key={file} className="flex items-center">
                                                <Button variant="link" className="p-0 h-auto">
                                                    <Paperclip className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    {file}
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {renderActionPanel()}
                {renderAIPanels()}
            </div>
            
            <div className="lg:col-span-1">
                <AuditTrail auditTrail={request.auditTrail} />
            </div>
        </div>
    );
}
