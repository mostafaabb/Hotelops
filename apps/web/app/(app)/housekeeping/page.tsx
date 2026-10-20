'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Plus,
  UserPlus,
  Play,
  CheckCheck,
  Trash2,
  PenLine,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { housekeepingApi, staffApi, roomsApi } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

const COLUMNS: { key: string; label: string }[] = [
  { key: 'DIRTY', label: 'Dirty' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'CLEANING', label: 'Cleaning' },
  { key: 'READY_FOR_INSPECTION', label: 'Ready for Inspection' },
  { key: 'INSPECTED', label: 'Inspected' },
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

const HK_STATUS_COLORS: Record<string, string> = {
  CLEAN: 'bg-green-100 text-green-800',
  DIRTY: 'bg-red-100 text-red-800',
  CLEANING: 'bg-yellow-100 text-yellow-800',
  INSPECTED: 'bg-purple-100 text-purple-800',
  OUT_OF_SERVICE: 'bg-gray-100 text-gray-800',
};

function formatElapsed(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function HousekeepingPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const queryClient = useQueryClient();

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['housekeeping'] });

  const dashboard = useQuery({
    queryKey: ['housekeeping', 'dashboard', activeHotelId],
    queryFn: () => housekeepingApi.dashboard(activeHotelId ? { hotelId: activeHotelId } : {}),
    refetchInterval: 30000,
  });

  const board = useQuery({
    queryKey: ['housekeeping', 'board', activeHotelId],
    queryFn: () => housekeepingApi.board(activeHotelId ? { hotelId: activeHotelId } : {}),
    refetchInterval: 30000,
  });

  const rooms = useQuery({
    queryKey: ['rooms', 'list', activeHotelId],
    queryFn: () => roomsApi.list({ hotelId: activeHotelId, pageSize: 200 }),
  });

  const staff = useQuery({
    queryKey: ['staff', 'list', activeHotelId],
    queryFn: () => staffApi.list({ hotelId: activeHotelId, pageSize: 200 }),
  });

  const dk = dashboard.data;
  const bk = board.data;

  const createMutation = useMutation({
    mutationFn: (body: any) => housekeepingApi.create(body),
    onSuccess: () => { toast.success('Task created'); invalidateAll(); setNewOpen(false); resetNewForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => housekeepingApi.assign(id, body),
    onSuccess: () => { toast.success('Task assigned'); invalidateAll(); setAssignOpen(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.start(id),
    onSuccess: () => { toast.success('Task started'); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.complete(id),
    onSuccess: () => { toast.success('Task completed'); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const inspectMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.inspect(id),
    onSuccess: () => { toast.success('Task inspected'); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => housekeepingApi.remove(id),
    onSuccess: () => { toast.success('Task cancelled'); invalidateAll(); setDeleteOpen(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => housekeepingApi.update(id, body),
    onSuccess: () => { toast.success('Task updated'); invalidateAll(); setEditOpen(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const setRoomStatusMutation = useMutation({
    mutationFn: ({ roomId, body }: { roomId: string; body: any }) =>
      housekeepingApi.setRoomStatus(roomId, body),
    onSuccess: () => { toast.success('Room status updated'); invalidateAll(); setStatusRoom(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const [newOpen, setNewOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState<any>(null);
  const [statusRoom, setStatusRoom] = useState<{ id: string; number: string; status: string } | null>(null);

  const [newForm, setNewForm] = useState({ roomId: '', priority: 'MEDIUM', notes: '', assignedTo: '' });
  const resetNewForm = () => setNewForm({ roomId: '', priority: 'MEDIUM', notes: '', assignedTo: '' });
  const [assignTo, setAssignTo] = useState('');
  const [editForm, setEditForm] = useState({ notes: '', priority: 'MEDIUM' });
  const [newStatus, setNewStatus] = useState('');

  const d = dk as any;
  const b = bk as any;

  const roomList: any[] = (rooms.data as any)?.items || [];
  const staffList: any[] = (staff.data as any)?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Housekeeping</h1>
          <p className="text-sm text-muted-foreground">Room cleanliness and task management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { board.refetch(); dashboard.refetch(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Dirty', value: d?.dirty, icon: AlertTriangle, tone: 'text-red-600' },
          { label: 'Cleaning', value: d?.cleaning, icon: Clock, tone: 'text-yellow-600' },
          { label: 'Clean', value: d?.clean, icon: Sparkles, tone: 'text-green-600' },
          { label: 'Inspected', value: d?.inspected, icon: ShieldCheck, tone: 'text-purple-600' },
          { label: "Today's Tasks", value: d?.todaysTasks, icon: ClipboardList, tone: 'text-blue-600' },
          { label: 'Completed Today', value: d?.tasksCompletedToday, icon: CheckCircle2, tone: 'text-emerald-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.tone}`} />
            </CardHeader>
            <CardContent>
              {kpi.value === undefined ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {d?.overdueTasks === undefined ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-orange-600">{d.overdueTasks}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Out of Service</CardTitle>
          </CardHeader>
          <CardContent>
            {d?.outOfService === undefined ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold text-gray-600">{d.outOfService}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Cleaning Time</CardTitle>
          </CardHeader>
          <CardContent>
            {d?.avgCleaningMinutes === undefined ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold flex items-center gap-1">
                <Timer className="h-5 w-5 text-muted-foreground" />{formatElapsed(d.avgCleaningMinutes)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total on Board</CardTitle>
          </CardHeader>
          <CardContent>
            {b?.counts?.total === undefined ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{b.counts.total}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Board</h2>
        {board.isLoading ? (
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {COLUMNS.map((col) => {
              const items: any[] = b?.columns?.[col.key]?.items || [];
              return (
                <div key={col.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="secondary">{b?.columns?.[col.key]?.count ?? items.length}</Badge>
                  </div>
                  <ScrollArea className="max-h-[500px]">
                    <div className="flex flex-col gap-2 pr-2">
                      {items.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">No rooms</p>
                      )}
                      {items.map((item: any, idx: number) => (
                        <Card key={item.taskId || `${item.roomId}-${idx}`} className="text-sm">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Room {item.roomNumber}</span>
                              <span className="text-xs text-muted-foreground">{item.roomType}</span>
                            </div>
                            {item.priority && (
                              <Badge className={PRIORITY_COLORS[item.priority] || ''}>{item.priority}</Badge>
                            )}
                            {item.assignedTo && (
                              <p className="text-xs text-muted-foreground">Assigned: {item.assignedTo}</p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatElapsed(item.elapsedMinutes)}</span>
                              <div className="flex gap-1">
                                {item.taskId && col.key === 'ASSIGNED' && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startMutation.mutate(item.taskId)} title="Start">
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                                {item.taskId && col.key === 'CLEANING' && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => completeMutation.mutate(item.taskId)} title="Complete">
                                    <CheckCheck className="h-3 w-3" />
                                  </Button>
                                )}
                                {item.taskId && col.key === 'READY_FOR_INSPECTION' && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => inspectMutation.mutate(item.taskId)} title="Inspect">
                                    <ShieldCheck className="h-3 w-3" />
                                  </Button>
                                )}
                                {item.taskId && col.key === 'DIRTY' && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAssignOpen(item.taskId); setAssignTo(''); }} title="Assign">
                                      <UserPlus className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                      setEditOpen(item);
                                      setEditForm({ notes: item.notes || '', priority: item.priority || 'MEDIUM' });
                                    }} title="Edit">
                                      <PenLine className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteOpen(item.taskId)} title="Delete">
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Room Status</h2>
        {rooms.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roomList.map((room: any) => (
              <div key={room.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{room.roomNumber}</span>
                  <Badge className={HK_STATUS_COLORS[room.housekeepingStatus] || ''}>
                    {room.housekeepingStatus}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusRoom({ id: room.id, number: room.roomNumber, status: room.housekeepingStatus });
                    setNewStatus('');
                  }}
                >
                  Set condition
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Housekeeping Task</DialogTitle>
            <DialogDescription>Create a task for a room.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Room</Label>
              <Select className="mt-1" value={newForm.roomId} onChange={(e) => setNewForm({ ...newForm, roomId: e.target.value })}>
                <option value="">Select room</option>
                {roomList.map((room: any) => (
                  <option key={room.id} value={room.id}>{room.roomNumber} — {room.roomType?.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select className="mt-1" value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to (optional)</Label>
              <Select className="mt-1" value={newForm.assignedTo} onChange={(e) => setNewForm({ ...newForm, assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {staffList.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                roomId: newForm.roomId,
                priority: newForm.priority,
                notes: newForm.notes || undefined,
                assignedTo: newForm.assignedTo || undefined,
              })}
              disabled={!newForm.roomId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignOpen} onOpenChange={() => setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>Select a staff member to assign this task to.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Staff Member</Label>
            <Select className="mt-1" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Select staff</option>
              {staffList.map((s: any) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button
              onClick={() => assignMutation.mutate({ id: assignOpen!, body: { assignedTo: assignTo } })}
              disabled={!assignTo || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select className="mt-1" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(null)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editOpen.taskId, body: editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteOpen} onOpenChange={() => setDeleteOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Task</DialogTitle>
            <DialogDescription>Are you sure you want to cancel this task? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(null)}>No, keep it</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteOpen!)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Cancelling...' : 'Yes, cancel task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusRoom} onOpenChange={() => setStatusRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Room Condition — Room {statusRoom?.number}</DialogTitle>
            <DialogDescription>Current status: {statusRoom?.status}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>New Condition</Label>
            <Select className="mt-1" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="">Select status</option>
              {['CLEAN', 'DIRTY', 'CLEANING', 'INSPECTED', 'OUT_OF_SERVICE'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusRoom(null)}>Cancel</Button>
            <Button
              onClick={() => setRoomStatusMutation.mutate({ roomId: statusRoom!.id, body: { housekeepingStatus: newStatus } })}
              disabled={!newStatus || setRoomStatusMutation.isPending}
            >
              {setRoomStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
