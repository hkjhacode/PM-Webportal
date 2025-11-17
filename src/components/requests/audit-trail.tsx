'use client';
import { AuditLog, User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { USERS } from "@/lib/data";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface AuditTrailProps {
    auditTrail: AuditLog[];
}

const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[1][0]}`;
    }
    return names[0].substring(0, 2);
};

export function AuditTrail({ auditTrail }: AuditTrailProps) {

    const findUser = (userId: string): User | undefined => USERS.find(u => u.id === userId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative pl-6">
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-border -translate-x-[11px]"></div>
                    {auditTrail.slice().reverse().map((log, index) => {
                        const user = findUser(log.userId);
                        return (
                            <div key={log.id} className="relative pb-8">
                                <div className="absolute left-0 top-1.5 w-[11px] h-[11px] bg-primary rounded-full -translate-x-1/2 border-4 border-background"></div>
                                <div className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8 mt-0.5">
                                        <AvatarImage src={user?.avatarUrl} alt={user?.name} data-ai-hint="professional portrait" />
                                        <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">
                                            {user?.name}
                                            <span className="text-muted-foreground font-normal"> ({user?.roles?.join(', ')})</span>
                                        </p>
                                        <p className="text-sm text-primary font-semibold">{log.action}</p>
                                        {log.notes && (
                                            <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted rounded-md border">{log.notes}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">{format(parseISO(log.timestamp), "PPP 'at' h:mm a")}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
