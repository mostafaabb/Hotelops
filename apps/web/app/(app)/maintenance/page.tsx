'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hammer,
  Plus,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { maintenanceApi, roomsApi, staffApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';

const REQUEST_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'INTERNET', 'APPLIANCE', 'STRUCTURAL', 'OTHER'] as const;

type RequestStatus = (typeof REQUEST_STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];
type Category = (typeof CATEGORIES)[number];

const STATUS_VARIANT: Record<RequestStatus, any> = {
  OPEN: 'info',
  ASSIGNED: 'secondary',
  IN_PROGRESS: 'warning',
  WAITING: 'outline',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

const PRIORITY_VARIANT: Record<Priority, any> = {
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'destructive',
};

function label(str: string) {
  return str
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function roomLabel(room: any) {
  return room ? `Room ${room.roomNumber}` : '—';
}

function assigneeName(u: any) {
  if (!u) return 'Unassigned';
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id;
}

export default function MaintenancePage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const queryClient = useQueryClient();
  const hotelQuery = activeHotelId ? { hotelId: activeHotelId } : {};

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [resolveTarget, setResolveTarget] = useState<any>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance'] });
  };

  const dashboard = useQuery({
    queryKey: ['maintenance', 'dashboard', activeHotelId],
    queryFn: () => maintenanceApi.dashboard(hotelQuery),
    refetchInterval: 30000,
  });

  const requests = useQuery({
    queryKey: ['maintenance', 'requests', activeHotelId, status, priority, roomSearch],
    queryFn: () =>
      maintenanceApi.list({
        ...hotelQuery,
        page: 1,
        pageSize: 100,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
      }),
    refetchInterval: 30000,
  });

  const rooms = useQuery({
    queryKey: ['rooms', activeHotelId],
    queryFn: () => roomsApi.list({ ...hotelQuery, pageSize: 100 }),
  });

  const staff = useQuery({
    queryKey: ['staff', activeHotelId],
    queryFn: () => staffApi.list({ ...hotelQuery, pageSize: 100 }),
  });

  const assign = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      maintenanceApi.assign(id, { assignedTo: assignedTo || staffOptions[0]?.user?.id }),
    onSuccess: () => {
      toast.success('Request assigned');
      setAssignTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to assign'),
  });

  const start = useMutation({
    mutationFn: (id: string) => maintenanceApi.start(id),
    onSuccess: () => {
      toast.success('Request started');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to start'),
  });

  const resolve = useMutation({
    mutationFn: ({ id, notes, cost }: { id: string; notes?: string; cost?: number }) =>
      maintenanceApi.resolve(id, { ...(notes ? { notes } : {}), ...(cost !== undefined && cost !== null ? { cost } : {}) }),
    onSuccess: () => {
      toast.success('Request resolved');
      setResolveTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to resolve'),
  });

  const close = useMutation({
    mutationFn: (id: string) => maintenanceApi.close(id),
    onSuccess: () => {
      toast.success('Request closed');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to close'),
  });

  const d = dashboard.data;
  const kpis = [
    { label: 'Open requests', value: d?.open, hint: 'Open / assigned / in progress', icon: Clock },
    { label: 'High priority', value: d?.highPriority, hint: 'High or urgent priority', icon: AlertTriangle },
    { label: 'In progress', value: d?.inProgress, hint: 'Currently being worked on', icon: Wrench },
    { label: 'Resolved today', value: d?.resolvedToday, hint: 'Completed since midnight', icon: CheckCircle2 },
    { label: 'Avg resolution', value: d?.avgResolutionHours !== undefined ? `${d.avgResolutionHours}h` : undefined, hint: 'Across resolved requests', icon: Hammer },
    { label: 'Total cost', value: d?.totalCost !== undefined ? formatCurrency(d.totalCost) : undefined, hint: 'All logged maintenance', icon: XCircle },
  ];

  const filtered = (requests.data?.items || []).filter((r: any) => {
    if (!roomSearch) return true;
    return String(r.room?.roomNumber || '').toLowerCase().includes(roomSearch.toLowerCase());
  });

  const staffOptions = (staff.data as any)?.items || (staff.data as any)?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-sm text-muted-foreground">Work orders and facility upkeep</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New request
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dashboard.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value ?? '—'}</div>
              )}
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {d?.mostProblematicRooms?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Most problematic rooms</CardTitle>
            <CardDescription>Rooms with the most maintenance requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {d.mostProblematicRooms.map((r: any) => (
                <Badge key={r.roomId} variant="outline" className="px-3 py-1">
                  Room {r.roomNumber || '—'} · {r.count} request{r.count === 1 ? '' : 's'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>{label(s)}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">All priorities</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{label(p)}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room search</Label>
              <Input placeholder="e.g. 204" value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9}><Skeleton className="h-24 w-full" /></TableCell>
                    </TableRow>
                  ) : !filtered.length ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        No maintenance requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <div>{r.requestNumber}</div>
                          <div className="text-xs font-normal text-muted-foreground">{r.title}</div>
                        </TableCell>
                        <TableCell>{roomLabel(r.room)}</TableCell>
                        <TableCell>{label(r.category)}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={r.description || ''}>
                          {r.description || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_VARIANT[r.priority as Priority] || 'outline'}>{label(r.priority)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[r.status as RequestStatus] || 'outline'}>{label(r.status)}</Badge>
                        </TableCell>
                        <TableCell>{assigneeName(r.assignedToUser)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <RequestActions
                            request={r}
                            staffOptions={staffOptions}
                            onAssign={() => setAssignTarget(r)}
                            onStart={() => start.mutate(r.id)}
                            onResolve={() => setResolveTarget(r)}
                            onClose={() => close.mutate(r.id)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <CreateRequestForm
            rooms={rooms.data?.items || []}
            staffOptions={staffOptions}
            onCreated={() => {
              setCreateOpen(false);
              invalidate();
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New maintenance request</DialogTitle>
            <DialogDescription>Log an issue for a room or the property.</DialogDescription>
          </DialogHeader>
          <CreateRequestForm
            rooms={rooms.data?.items || []}
            staffOptions={staffOptions}
            onCreated={() => {
              setCreateOpen(false);
              invalidate();
            }}
            compact
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign request</DialogTitle>
            <DialogDescription>{assignTarget?.requestNumber} · {assignTarget?.title}</DialogDescription>
          </DialogHeader>
          <AssignForm
            staffOptions={staffOptions}
            onAssign={(assignedTo) => assign.mutate({ id: assignTarget.id, assignedTo })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve request</DialogTitle>
            <DialogDescription>{resolveTarget?.requestNumber} · {resolveTarget?.title}</DialogDescription>
          </DialogHeader>
          <ResolveForm
            onResolve={(notes, cost) => resolve.mutate({ id: resolveTarget.id, notes, cost })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestActions({
  request,
  staffOptions,
  onAssign,
  onStart,
  onResolve,
  onClose,
}: {
  request: any;
  staffOptions: any[];
  onAssign: () => void;
  onStart: () => void;
  onResolve: () => void;
  onClose: () => void;
}) {
  const s = request.status as RequestStatus;
  const canStart = s === 'OPEN' || s === 'ASSIGNED' || s === 'WAITING';
  const canResolve = s !== 'RESOLVED' && s !== 'CLOSED';
  const canClose = s === 'RESOLVED';
  const canAssign = s === 'OPEN' || s === 'ASSIGNED' || s === 'WAITING';

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canAssign && (
        <Button variant="outline" size="sm" onClick={onAssign} disabled={!staffOptions.length}>
          Assign
        </Button>
      )}
      {canStart && (
        <Button variant="outline" size="sm" onClick={onStart}>
          Start
        </Button>
      )}
      {canResolve && (
        <Button variant="outline" size="sm" onClick={onResolve}>
          Resolve
        </Button>
      )}
      {canClose && (
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      )}
    </div>
  );
}

function CreateRequestForm({
  rooms,
  staffOptions,
  onCreated,
  compact = false,
}: {
  rooms: any[];
  staffOptions: any[];
  onCreated: () => void;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [roomId, setRoomId] = useState('');
  const [category, setCategory] = useState<Category>('PLUMBING');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () =>
      maintenanceApi.create({
        ...(roomId ? { roomId } : {}),
        category,
        priority,
        title,
        ...(description ? { description } : {}),
      }),
    onSuccess: () => {
      toast.success('Maintenance request created');
      setTitle('');
      setDescription('');
      setRoomId('');
      setCategory('PLUMBING');
      setPriority('MEDIUM');
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create request'),
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leaking faucet in bathroom" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Room</Label>
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">No room / general</option>
              {rooms.map((r: any) => (
                <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{label(c)}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{label(p)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details, fault symptoms, etc." />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create request'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignForm({ staffOptions, onAssign }: { staffOptions: any[]; onAssign: (staffId: string) => void }) {
  const [assignedTo, setAssignedTo] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Staff member</Label>
        <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Select…</option>
          {staffOptions.map((s: any) => (
            <option key={s.id} value={s.user?.id}>
              {s.user?.firstName} {s.user?.lastName} ({s.position})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Note</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional instruction for the assignee" />
      </div>
      <DialogFooter>
        <DialogCloseButton onClick={() => onAssign(assignedTo)} disabled={!assignedTo} label="Assign" />
      </DialogFooter>
    </div>
  );
}

function ResolveForm({ onResolve }: { onResolve: (notes?: string, cost?: number) => void }) {
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Cost charged {cost !== '' && !isNaN(Number(cost)) ? `(${formatCurrency(Number(cost))})` : ''}</Label>
        <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional cost" />
      </div>
      <div className="space-y-2">
        <Label>Resolution notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was fixed, parts used, follow-ups" />
      </div>
      <DialogFooter>
        <DialogCloseButton
          onClick={() => onResolve(notes || undefined, cost !== '' ? Number(cost) : undefined)}
          label="Resolve"
        />
      </DialogFooter>
    </div>
  );
}

function DialogCloseButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <Button onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}