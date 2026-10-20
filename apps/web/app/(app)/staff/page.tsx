'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  Search,
  UserRound,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { patch, usersApi, staffApi, departmentsApi } from '@/lib/api';
import { formatDate, initials } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PAGE_SIZE = 20;

const USER_ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'FRONT_DESK',
  'RESERVATION_AGENT',
  'HOUSEKEEPING_MANAGER',
  'HOUSEKEEPER',
  'MAINTENANCE_MANAGER',
  'MAINTENANCE_STAFF',
  'ACCOUNTANT',
  'STAFF',
] as const;

const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED'] as const;
const STAFF_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT'] as const;

const ROLE_VARIANT: Record<string, any> = {
  SUPER_ADMIN: 'default',
  OWNER: 'default',
  GENERAL_MANAGER: 'default',
  HOTEL_MANAGER: 'default',
  ACCOUNTANT: 'info',
  FRONT_DESK: 'secondary',
  RESERVATION_AGENT: 'info',
  HOUSEKEEPING_MANAGER: 'success',
  HOUSEKEEPER: 'success',
  MAINTENANCE_MANAGER: 'warning',
  MAINTENANCE_STAFF: 'warning',
  STAFF: 'muted',
};

const USER_STATUS_VARIANT: Record<string, any> = {
  ACTIVE: 'success',
  INACTIVE: 'muted',
  SUSPENDED: 'destructive',
  INVITED: 'warning',
};

const STAFF_STATUS_VARIANT: Record<string, any> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive',
};

function titleCase(v: string) {
  return v.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StaffPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const hotels = useAuth((s) => s.hotels);
  const qc = useQueryClient();

  const [tab, setTab] = useState('users');

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [hotelId, setHotelId] = useState('');
  const [page, setPage] = useState(1);

  const [sSearch, setSSearch] = useState('');
  const [sDepartment, setSDepartment] = useState('');
  const [sStatus, setSStatus] = useState('');
  const [sHotelId, setSHotelId] = useState('');
  const [sPage, setSPage] = useState(1);

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [terminating, setTerminating] = useState<any>(null);
  const [terminatingBusy, setTerminatingBusy] = useState(false);

  const departments = useQuery({
    queryKey: ['departments', activeHotelId],
    queryFn: () => departmentsApi.list(),
  });
  const depOptions: any[] = departments.data || [];

  const users = useQuery({
    queryKey: ['users', activeHotelId, search, role, status, hotelId, page],
    queryFn: () =>
      usersApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        role: role || undefined,
        status: status || undefined,
        hotelId: hotelId || activeHotelId || undefined,
      }),
  });

  const staffList = useQuery({
    queryKey: ['staff', 'list', activeHotelId, sSearch, sDepartment, sStatus, sHotelId, sPage],
    queryFn: () =>
      staffApi.list({
        page: sPage,
        pageSize: PAGE_SIZE,
        search: sSearch || undefined,
        departmentId: sDepartment || undefined,
        status: sStatus || undefined,
        hotelId: sHotelId || activeHotelId || undefined,
      }),
  });

  const staffLookup = useQuery({
    queryKey: ['staff', 'lookup', activeHotelId],
    queryFn: () => staffApi.list({ page: 1, pageSize: 100, hotelId: activeHotelId || undefined }),
    enabled: tab === 'users' || userFormOpen,
  });

  const staffByUser: Record<string, any> = {};
  for (const s of (staffLookup.data as any)?.data || []) staffByUser[s.userId] = s;

  const userItems: any[] = (users.data as any)?.data || [];
  const userTotal = users.data?.total || 0;
  const userPages = Math.max(1, Math.ceil(userTotal / PAGE_SIZE));

  const staffItems: any[] = (staffList.data as any)?.data || [];
  const staffTotal = staffList.data?.total || 0;
  const staffPages = Math.max(1, Math.ceil(staffTotal / PAGE_SIZE));

  const hotelName = (id?: string | null) => (id ? hotels.find((h) => h.id === id)?.name || '—' : '—');

  const toggleUserStatus = async (u: any) => {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await patch(`/users/${u.id}/status`, { status: next });
      toast.success(next === 'ACTIVE' ? 'User activated' : 'User deactivated');
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update user status');
    }
  };

  const confirmTerminate = async () => {
    if (!terminating) return;
    setTerminatingBusy(true);
    try {
      await staffApi.setStatus(terminating.id, 'TERMINATED');
      toast.success(`${terminating.user?.firstName} ${terminating.user?.lastName} terminated`);
      qc.invalidateQueries({ queryKey: ['staff'] });
      setTerminating(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to terminate staff member');
    } finally {
      setTerminatingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff &amp; Users</h1>
          <p className="text-sm text-muted-foreground">Manage accounts, roles and employment records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingStaff(null);
              setStaffFormOpen(true);
            }}
          >
            <Briefcase /> New staff profile
          </Button>
          <Button
            onClick={() => {
              setEditingUser(null);
              setUserFormOpen(true);
            }}
          >
            <Plus /> New user
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="staff">Staff profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-72 pl-8"
                  placeholder="Name or email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select className="w-44" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
                <option value="">All roles</option>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Hotel</Label>
              <Select className="w-48" value={hotelId} onChange={(e) => { setHotelId(e.target.value); setPage(1); }}>
                <option value="">All hotels</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            {users.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : userItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No users match the current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userItems.map((u) => {
                    const staff = staffByUser[u.id];
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{initials(u.firstName, u.lastName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ROLE_VARIANT[u.role] || 'outline'}>{titleCase(u.role)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{staff?.department?.name || '—'}</TableCell>
                        <TableCell className="text-sm">{hotelName(u.hotelId)}</TableCell>
                        <TableCell>
                          <Badge variant={USER_STATUS_VARIANT[u.status] || 'outline'}>{u.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                Actions
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser(u);
                                  setUserFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleUserStatus(u)}>
                                <Power className="h-4 w-4" /> {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {userItems.length} of {userTotal} users</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> Prev
              </Button>
              <span className="text-sm tabular-nums">{users.data?.page || page} / {userPages}</span>
              <Button variant="outline" size="sm" disabled={page >= userPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-72 pl-8"
                  placeholder="Name, position or employee ID…"
                  value={sSearch}
                  onChange={(e) => {
                    setSSearch(e.target.value);
                    setSPage(1);
                  }}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Select className="w-48" value={sDepartment} onChange={(e) => { setSDepartment(e.target.value); setSPage(1); }}>
                <option value="">All departments</option>
                {depOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select className="w-44" value={sStatus} onChange={(e) => { setSStatus(e.target.value); setSPage(1); }}>
                <option value="">All statuses</option>
                {STAFF_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Hotel</Label>
              <Select className="w-48" value={sHotelId} onChange={(e) => { setSHotelId(e.target.value); setSPage(1); }}>
                <option value="">All hotels</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            {staffList.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : staffItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No staff profiles match the current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Hired</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Hotel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffItems.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initials(s.user?.firstName, s.user?.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {s.user?.firstName} {s.user?.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{s.employeeId}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.position}</TableCell>
                      <TableCell className="text-sm">{s.department?.name || '—'}</TableCell>
                      <TableCell className="text-sm">{formatDate(s.hireDate)}</TableCell>
                      <TableCell className="text-sm">{s.employmentType || '—'}</TableCell>
                      <TableCell className="text-sm">{hotelName(s.hotelId)}</TableCell>
                      <TableCell>
                        <Badge variant={STAFF_STATUS_VARIANT[s.status] || 'outline'}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingStaff(s);
                                setStaffFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" /> Edit profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTerminating(s)}
                              className="text-destructive focus:text-destructive"
                            >
                              <UserRound className="h-4 w-4" /> Terminate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {staffItems.length} of {staffTotal} staff</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={sPage <= 1} onClick={() => setSPage((p) => p - 1)}>
                <ChevronLeft /> Prev
              </Button>
              <span className="text-sm tabular-nums">{staffList.data?.page || sPage} / {staffPages}</span>
              <Button variant="outline" size="sm" disabled={sPage >= staffPages} onClick={() => setSPage((p) => p + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {userFormOpen && (
        <UserForm
          initial={editingUser}
          staff={editingUser ? staffByUser[editingUser.id] : null}
          departments={depOptions}
          hotels={hotels}
          activeHotelId={activeHotelId}
          open={userFormOpen}
          onOpenChange={(o) => {
            setUserFormOpen(o);
            if (!o) setEditingUser(null);
          }}
        />
      )}

      {staffFormOpen && (
        <StaffForm
          initial={editingStaff}
          departments={depOptions}
          staffByUser={staffByUser}
          open={staffFormOpen}
          onOpenChange={(o) => {
            setStaffFormOpen(o);
            if (!o) setEditingStaff(null);
          }}
        />
      )}

      <Dialog open={!!terminating} onOpenChange={(o) => !o && setTerminating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate staff member?</DialogTitle>
            <DialogDescription>
              {terminating?.user?.firstName} {terminating?.user?.lastName} ({terminating?.position}) will be marked as
              terminated and removed from active duty.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminating(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmTerminate} disabled={terminatingBusy}>
              {terminatingBusy ? 'Terminating…' : 'Terminate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UserFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  hotelId: string;
  departmentId: string;
  position: string;
}

function UserForm({
  initial,
  staff,
  departments,
  hotels,
  activeHotelId,
  open,
  onOpenChange,
}: {
  initial: any;
  staff: any;
  departments: any[];
  hotels: any[];
  activeHotelId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, watch } = useForm<UserFormValues>({
    defaultValues: {
      firstName: initial?.firstName || '',
      lastName: initial?.lastName || '',
      email: initial?.email || '',
      password: '',
      role: initial?.role || 'STAFF',
      hotelId: initial?.hotelId || activeHotelId || '',
      departmentId: staff?.departmentId || '',
      position: staff?.position || '',
    },
  });

  const departmentId = watch('departmentId');

  const onSubmit = async (v: UserFormValues) => {
    if (!v.firstName.trim() || !v.lastName.trim() || !v.email.trim()) {
      toast.error('First name, last name and email are required');
      return;
    }
    if (!isEdit && !v.password) {
      toast.error('A password is required for new users');
      return;
    }
    if (v.departmentId && !v.position.trim()) {
      toast.error('A position is required when assigning a department');
      return;
    }
    setSaving(true);
    try {
      const userBody: any = {
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email: v.email.trim(),
        role: v.role,
        hotelId: v.hotelId || undefined,
      };
      if (isEdit) {
        await usersApi.update(initial.id, userBody);
      } else {
        if (v.password) userBody.password = v.password;
        const created: any = await usersApi.create(userBody);
        if (v.departmentId && v.position.trim()) {
          await staffApi.create({ userId: created.id, departmentId: v.departmentId, position: v.position.trim() });
        }
      }
      if (isEdit && v.departmentId) {
        if (staff) {
          await staffApi.update(staff.id, { departmentId: v.departmentId, position: v.position.trim() });
        } else if (v.position.trim()) {
          await staffApi.create({ userId: initial.id, departmentId: v.departmentId, position: v.position.trim() });
        }
      }
      toast.success(isEdit ? 'User updated' : 'User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'New user'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update ${initial.firstName} ${initial.lastName}` : 'Create an account and optional staff record'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>First name</Label>
              <Input placeholder="Jane" {...register('firstName')} />
            </div>
            <div className="grid gap-2">
              <Label>Last name</Label>
              <Input placeholder="Smith" {...register('lastName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" placeholder="jane@hotel.com" {...register('email')} />
            </div>
            {!isEdit && (
              <div className="grid gap-2">
                <Label>Password</Label>
                <Input type="password" placeholder="Temporary password" {...register('password')} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select {...register('role')}>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Hotel</Label>
              <Select {...register('hotelId')}>
                <option value="">All hotels</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select {...register('departmentId')}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            {departmentId && (
              <div className="grid gap-2">
                <Label>Position</Label>
                <Input placeholder="Front Desk Agent" {...register('position')} />
              </div>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StaffFormValues {
  userId: string;
  departmentId: string;
  position: string;
  hireDate: string;
  employmentType: string;
  status: string;
  salary: string;
  emergencyContact: string;
  notes: string;
}

function StaffForm({
  initial,
  departments,
  staffByUser,
  open,
  onOpenChange,
}: {
  initial: any;
  departments: any[];
  staffByUser: Record<string, any>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  const users = useQuery({
    queryKey: ['users', 'select'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
  } = useForm<StaffFormValues>({
    defaultValues: {
      userId: initial?.userId || '',
      departmentId: initial?.departmentId || '',
      position: initial?.position || '',
      hireDate: initial?.hireDate ? initial.hireDate.slice(0, 10) : '',
      employmentType: initial?.employmentType || 'FULL_TIME',
      status: initial?.status || 'ACTIVE',
      salary: initial?.salary != null ? String(initial.salary) : '',
      emergencyContact: initial?.emergencyContact || '',
      notes: initial?.notes || '',
    },
  });

  const availableUsers = ((users.data as any)?.data || []).filter(
    (u: any) => (isEdit && u.id === initial.userId) || !staffByUser[u.id]
  );

  const onSubmit = async (v: StaffFormValues) => {
    if (!v.position.trim()) {
      toast.error('Position is required');
      return;
    }
    if (!isEdit && !v.userId) {
      toast.error('Select a user for this staff member');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        departmentId: v.departmentId || undefined,
        position: v.position.trim(),
        hireDate: v.hireDate || undefined,
        salary: v.salary ? Number(v.salary) : undefined,
        employmentType: v.employmentType,
        emergencyContact: v.emergencyContact || undefined,
        notes: v.notes || undefined,
      };
      if (isEdit) {
        body.status = v.status;
        await staffApi.update(initial.id, body);
      } else {
        body.userId = v.userId;
        await staffApi.create(body);
      }
      toast.success(isEdit ? 'Staff profile updated' : 'Staff profile created');
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save staff profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit staff profile' : 'New staff profile'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `${initial.user?.firstName} ${initial.user?.lastName}` : 'Attach employment details to a user'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isEdit && (
            <div className="grid gap-2">
              <Label>User</Label>
              <Select {...register('userId')}>
                <option value="">Select a user…</option>
                {availableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Position</Label>
              <Input placeholder="Front Desk Agent" {...register('position')} />
            </div>
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select {...register('departmentId')}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Hire date</Label>
              <Input type="date" {...register('hireDate')} />
            </div>
            <div className="grid gap-2">
              <Label>Employment type</Label>
              <Select {...register('employmentType')}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </Select>
            </div>
            {isEdit ? (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select {...register('status')}>
                  {STAFF_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Salary</Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" {...register('salary')} />
              </div>
            )}
          </div>
          {isEdit && (
            <div className="grid gap-2">
              <Label>Salary</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" {...register('salary')} />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Emergency contact</Label>
            <Input placeholder="Phone or name" {...register('emergencyContact')} />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea placeholder="Optional notes" {...register('notes')} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create staff profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}