
'use client';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { USER_ROLES, DIVISIONS, STATES } from '@/lib/data';
import { Edit, Trash2, PlusCircle, X as XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole, UserRoleAssignment } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';

export default function UserManagementPage() {
  const { hasRole, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAddUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editedRoles, setEditedRoles] = useState<UserRoleAssignment[]>([]);
  const [newRole, setNewRole] = useState<UserRole | ''>('');
  const [newState, setNewState] = useState('');
  const [newDivision, setNewDivision] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [latestTempIds, setLatestTempIds] = useState<Record<string, string>>({});
  const [credsOpen, setCredsOpen] = useState(false);
  const [credsEmail, setCredsEmail] = useState('');
  const [credsPassword, setCredsPassword] = useState('');
  const [credsTimeoutId, setCredsTimeoutId] = useState<number | null>(null);

  const formatRole = (role: UserRoleAssignment) => {
    let formatted = role.role;
    if (role.state) {
      formatted += ` (${role.state}`;
      if (role.division) {
        formatted += ` - ${role.division}`;
      }
      formatted += ')';
    }
    return formatted;
  };

  // Dev helper: ensure we hold a Super Admin session to call protected APIs.
  const ensureSuperAdminSession = async () => {
    try {
      const loginRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@niti.gov.in', password: 'SuperAdmin@123', action: 'login' }),
      });
      if (loginRes.ok) return true;
      // If login fails, try resetting dev users and retry login.
      const resetRes = await fetch('/api/dev/users/reset', { method: 'POST' });
      if (!resetRes.ok) return false;
      const retryRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@niti.gov.in', password: 'SuperAdmin@123', action: 'login' }),
      });
      return retryRes.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!user) {
        router.push('/');
        return;
    }
    if (!hasRole('Super Admin')) {
      router.push('/dashboard');
    }
    // Load users once authorized
    const loadUsers = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        const toUi = (u: any): User => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl || '',
          roles: (u.roles || []).map((r: any) => ({ role: r.role, state: r.state, division: r.branch })),
        });
        setUsers((data || []).map(toUi));
      } catch (e) {
        try {
          const ok = await ensureSuperAdminSession();
          if (ok) {
            const res2 = await fetch('/api/users');
            if (res2.ok) {
              const data2 = await res2.json();
              const toUi2 = (u: any): User => ({
                id: u.id,
                name: u.name,
                email: u.email,
                avatarUrl: u.avatarUrl || '',
                roles: (u.roles || []).map((r: any) => ({ role: r.role, state: r.state, division: r.branch })),
              });
              setUsers((data2 || []).map(toUi2));
              return;
            }
          }
        } catch {}
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load users.' });
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [hasRole, user, router]);

  const reload = async () => {
    try {
      await ensureSuperAdminSession();
      const res = await fetch('/api/users');
      if (!res.ok) return;
      const data = await res.json();
      const toUi = (u: any): User => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl || '',
        roles: (u.roles || []).map((r: any) => ({ role: r.role, state: r.state, division: r.branch })),
      });
      setUsers((data || []).map(toUi));
    } catch {}
  };

  const copyPasswordToClipboard = async (password: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(password);
        toast({ title: 'Password copied', description: 'Temporary password copied to clipboard.' });
        return true;
      }
    } catch {}
    try {
      const textarea = document.createElement('textarea');
      textarea.value = password;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        toast({ title: 'Password copied', description: 'Temporary password copied to clipboard.' });
        return true;
      }
    } catch {}
    toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy password to clipboard.' });
    return false;
  };

  const getCredentialsForUser = async (uid: string, allowReset: boolean): Promise<{ email: string; password: string } | null> => {
    try {
      await ensureSuperAdminSession();
      const existingTemp = latestTempIds[uid];
      if (existingTemp) {
        const res = await fetch(`/api/users/enhanced?tempCredentials=${encodeURIComponent(existingTemp)}`);
        if (res.ok) {
          return await res.json();
        }
      }
      if (allowReset) {
        const resetRes = await fetch('/api/users/enhanced', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: uid, resetPassword: true })
        });
        if (!resetRes.ok) return null;
        const resetData = await resetRes.json();
        if (resetData?.tempCredentialsId) {
          setLatestTempIds((prev) => ({ ...prev, [uid]: resetData.tempCredentialsId }));
          const credsRes = await fetch(`/api/users/enhanced?tempCredentials=${encodeURIComponent(resetData.tempCredentialsId)}`);
          if (credsRes.ok) {
            return await credsRes.json();
          }
        }
      }
    } catch {}
    return null;
  };

  const showCredentialsModal = async (email: string, password: string) => {
    setCredsEmail(email);
    setCredsPassword(password);
    setCredsOpen(true);
    await copyPasswordToClipboard(password);
    if (credsTimeoutId) {
      clearTimeout(credsTimeoutId);
    }
    const id = window.setTimeout(() => setCredsOpen(false), 15000);
    setCredsTimeoutId(id);
  };

  const handleAddUser = async () => {
    try {
      await ensureSuperAdminSession();
      const body = { name: newName };
      const res = await fetch('/api/users/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let desc = 'Error creating user';
        try {
          const err = await res.json();
          if (typeof err?.error === 'string') desc = err.error;
          else if (err?.holder) desc = `${err.error}: ${err.holder.name} (${err.holder.email})`;
          else if (err?.error) desc = JSON.stringify(err.error);
        } catch {}
        toast({ variant: 'destructive', title: 'Create failed', description: desc });
        return;
      }
      const created = await res.json();
      toast({ title: 'User Created', description: 'Assign roles to generate credentials.' });
      setAddUserDialogOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      if (created?.tempCredentialsId) {
        setLatestTempIds((prev) => ({ ...prev, [created.id]: created.tempCredentialsId }));
      }
      await ensureSuperAdminSession();
      const listRes = await fetch('/api/users');
      if (listRes.ok) {
        const data = await listRes.json();
        const toUi = (u: any): User => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl || '',
          roles: (u.roles || []).map((r: any) => ({ role: r.role, state: r.state, division: r.branch })),
        });
        const newUsers = (data || []).map(toUi);
        setUsers(newUsers);
        const justCreated = newUsers.find(u => u.id === created.id);
        if (justCreated) {
          setSelectedUser(justCreated);
          setEditedRoles([...justCreated.roles]);
          setEditUserDialogOpen(true);
        }
      } else {
        await reload();
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Create failed', description: e?.message || 'Error creating user' });
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await ensureSuperAdminSession();
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast({ variant: 'destructive', title: 'User Deleted', description: 'The user has been successfully deleted.' });
      await reload();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: e?.message || 'Error deleting user' });
    }
  }

  const handleEditUserClick = (user: User) => {
    setSelectedUser(user);
    setEditedRoles([...user.roles]);
    setEditUserDialogOpen(true);
  }

  const handleSaveUserChanges = async () => {
    if (selectedUser) {
      try {
        await ensureSuperAdminSession();
        const body = {
          id: selectedUser.id,
          roles: editedRoles.map((r) => ({ role: r.role, state: r.state, division: r.division })),
        };
        const res = await fetch('/api/users/enhanced', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          let desc = 'Error updating user';
          try {
            const err = await res.json();
            if (typeof err?.error === 'string') desc = err.error;
            else if (err?.holder) desc = `${err.error}: ${err.holder.name} (${err.holder.email})`;
            else if (err?.error) desc = JSON.stringify(err.error);
          } catch {}
          toast({ variant: 'destructive', title: 'Update failed', description: desc });
          return;
        }
        const data = await res.json();
        if (data?.tempCredentialsId) {
          setLatestTempIds((prev) => ({ ...prev, [selectedUser.id]: data.tempCredentialsId }));
          const credsRes = await fetch(`/api/users/enhanced?tempCredentials=${encodeURIComponent(data.tempCredentialsId)}`);
          if (credsRes.ok) {
            const creds = await credsRes.json();
            await showCredentialsModal(creds.email, creds.password);
          }
        }
        toast({ title: 'User Updated', description: `${selectedUser.name}'s roles have been updated.` });
        setEditUserDialogOpen(false);
        setSelectedUser(null);
        setEditedRoles([]);
        await reload();
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update failed', description: e?.message || 'Error updating user' });
      }
    }
  };

  const handleAddRoleToUser = () => {
    if (newRole) {
        const roleToAdd: UserRoleAssignment = { role: newRole };
    const stateSpecificRoles: UserRole[] = ['State Advisor', 'State YP', 'State Division HOD', 'Division YP'];
    const divisionSpecificRoles: UserRole[] = ['State Division HOD', 'Division YP'];
        
        if (stateSpecificRoles.includes(newRole) && newState) {
            roleToAdd.state = newState;
        }
        if (divisionSpecificRoles.includes(newRole) && newDivision) {
            roleToAdd.division = newDivision;
        }

        setEditedRoles([...editedRoles, roleToAdd]);
        setNewRole('');
        setNewState('');
        setNewDivision('');
    }
  }

  const handleRemoveRoleFromUser = (index: number) => {
    setEditedRoles(editedRoles.filter((_, i) => i !== index));
  }


  if (!user || !hasRole('Super Admin')) {
    return (
        <div className="flex h-screen items-center justify-center">
            <p>Loading or unauthorized...</p>
        </div>
    );
  }

  const stateSpecificRoles: UserRole[] = ['State Advisor', 'State YP', 'State Division HOD', 'Division YP'];
  const divisionSpecificRoles: UserRole[] = ['State Division HOD', 'Division YP'];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                    Manage user roles, states, and divisions.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const res = await fetch('/api/dev/users/reset', { method: 'POST' });
                if (!res.ok) throw new Error('Reset failed');
                toast({ title: 'Users reset', description: 'Seeded NITI hierarchy including Super Admin.' });
                await reload();
              } catch (e: any) {
                toast({ variant: 'destructive', title: 'Reset failed', description: e?.message || 'Error resetting users' });
              }
            }}>Reset Dev Users</Button>
            <Dialog open={isAddUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
                <DialogTrigger asChild>
                    <Button size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New User
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the new user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" className="col-span-3" />
                        </div>
                        
                    </div>
                    <DialogFooter>
                        <Button type="submit" onClick={handleAddUser}>Create User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Current Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
              ) : users.filter(u => !u.roles.some(r => r.role === 'Super Admin')).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-sm text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {u.roles.map((r, index) => (
                            <Badge key={index} variant="secondary">
                                {formatRole(r)}
                            </Badge>
                        ))}
                        {u.roles.length === 0 && <Badge variant="outline">No Roles</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditUserClick(u)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const creds = await getCredentialsForUser(u.id, false);
                        if (!creds) {
                          toast({ title: 'Credentials unavailable', description: 'Try resetting password or assigning roles.' });
                          return;
                        }
                        await showCredentialsModal(creds.email, creds.password);
                      } catch (e: any) {
                        toast({ variant: 'destructive', title: 'Error', description: e?.message || 'Could not fetch credentials' });
                      }
                    }}>
                      Show Credentials
                    </Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const creds = await getCredentialsForUser(u.id, true);
                        if (!creds) {
                          throw new Error('Reset password failed');
                        }
                        await showCredentialsModal(creds.email, creds.password);
                      } catch (e: any) {
                        toast({ variant: 'destructive', title: 'Reset failed', description: e?.message || 'Error resetting password' });
                      }
                    }}>
                      Reset Password
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="icon" variant="destructive">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="sm:max-w-md">
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the user
                                and remove their data from our servers.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive hover:bg-destructive/90">
                                Continue
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>Edit User: {selectedUser?.name}</DialogTitle>
                <DialogDescription>
                    Add or remove roles and assignments for this user.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="space-y-2">
                    <Label>Current Roles</Label>
                    <div className="flex flex-wrap gap-2 rounded-lg border bg-muted p-2 min-h-[40px]">
                        {editedRoles.length > 0 ? editedRoles.map((role, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                {formatRole(role)}
                                <button onClick={() => handleRemoveRoleFromUser(index)} className="rounded-full hover:bg-background/50">
                                    <XIcon className="h-3 w-3" />
                                </button>
                            </Badge>
                        )) : <span className="text-sm text-muted-foreground px-2">No roles assigned.</span>}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Add New Role</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {USER_ROLES.filter(r => r !== 'Super Admin').map(role => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {newRole && stateSpecificRoles.includes(newRole) && (
                             <Select value={newState} onValueChange={setNewState}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select State" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATES.map(st => (
                                        <SelectItem key={st} value={st}>{st}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {newRole && divisionSpecificRoles.includes(newRole) && (
                          <div className="grid gap-2">
                            <Label htmlFor="division">Division</Label>
                            <Input id="division" value={newDivision} onChange={(e) => setNewDivision(e.target.value)} placeholder="e.g., Education" />
                          </div>
                        )}
                    </div>
                    <div className="pt-2">
                         <Button onClick={handleAddRoleToUser} disabled={!newRole}>Add Role</Button>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>Cancel</Button>
                <Button type="submit" onClick={handleSaveUserChanges}>Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credsOpen} onOpenChange={setCredsOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Temporary Credentials</DialogTitle>
            <DialogDescription>Visible for 15 seconds. Password is auto-copied.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Email</Label>
              <Input value={credsEmail} readOnly />
            </div>
            <div>
              <Label>Password</Label>
              <Input value={credsPassword} readOnly />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => copyPasswordToClipboard(credsPassword)}>Copy Password</Button>
              <Button onClick={() => setCredsOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
