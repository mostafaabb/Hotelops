'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, BedDouble, ChevronLeft, ChevronRight, DoorOpen, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { get, roomsApi, buildingsApi } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/format';
import { useAuth } from '@/store/auth';

const STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'CLEANING', 'INSPECTED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'];

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  DIRTY: 'Dirty',
  CLEANING: 'Cleaning',
  INSPECTED: 'Inspected',
  OUT_OF_ORDER: 'Out of order',
  OUT_OF_SERVICE: 'Out of service',
};

const STATUS_VARIANT: Record<string, any> = {
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  RESERVED: 'muted',
  DIRTY: 'warning',
  CLEANING: 'secondary',
  INSPECTED: 'outline',
  OUT_OF_ORDER: 'destructive',
  OUT_OF_SERVICE: 'destructive',
};

const DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  destructive: 'bg-red-500',
  secondary: 'bg-muted-foreground',
  outline: 'bg-border',
  muted: 'bg-muted-foreground',
};

const SETTABLE_STATUSES = STATUSES.filter((s) => s !== 'OCCUPIED');
const REASONS = ['MAINTENANCE', 'RENOVATION', 'OWNER_USE', 'CLEANING', 'OTHER'];
const PAGE_SIZE = 24;

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function RoomsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const hotels = useAuth((s) => s.hotels);
  const qc = useQueryClient();

  const [hotelFilter, setHotelFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setHotelFilter(activeHotelId ?? '');
    setPage(1);
  }, [activeHotelId]);

  const stats = useQuery({
    queryKey: ['rooms', 'stats', hotelFilter],
    queryFn: () =>
      get<{ total: number; byStatus: Record<string, number>; byHousekeepingStatus: Record<string, number> }>(
        '/rooms/stats',
        hotelFilter ? { hotelId: hotelFilter } : {}
      ),
  });

  const rooms = useQuery({
    queryKey: ['rooms', 'list', hotelFilter, buildingFilter, floorFilter, statusFilter, page],
    queryFn: () =>
      roomsApi.list({
        page,
        pageSize: PAGE_SIZE,
        hotelId: hotelFilter || undefined,
        buildingId: buildingFilter || undefined,
        floorId: floorFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const buildings = useQuery({
    queryKey: ['buildings', 'floors', hotelFilter],
    queryFn: () => buildingsApi.list(hotelFilter ? { hotelId: hotelFilter } : {}),
  });

  const byStatus: Record<string, number> = stats.data?.byStatus || {};
  const statCards = [
    { label: 'Available', value: byStatus.AVAILABLE ?? 0, icon: DoorOpen, color: 'text-emerald-600' },
    { label: 'Occupied', value: byStatus.OCCUPIED ?? 0, icon: BedDouble, color: 'text-blue-600' },
    { label: 'Dirty', value: byStatus.DIRTY ?? 0, icon: RefreshCw, color: 'text-amber-600' },
    { label: 'Out of service', value: (byStatus.OUT_OF_SERVICE ?? 0) + (byStatus.OUT_OF_ORDER ?? 0), icon: Ban, color: 'text-red-600' },
  ];
  const totalPages = rooms.data ? Math.max(1, Math.ceil(rooms.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
        <p className="text-sm text-muted-foreground">Live room inventory and status control</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              {stats.isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold">{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {hotels.length > 1 && (
          <div className="grid gap-1.5">
            <Label>Hotel</Label>
            <Select
              value={hotelFilter}
              onChange={(e) => {
                setHotelFilter(e.target.value);
                setPage(1);
              }}
              className="w-48"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label>Building</Label>
          <Select
            value={buildingFilter}
            onChange={(e) => {
              setBuildingFilter(e.target.value);
              setFloorFilter('');
              setPage(1);
            }}
            className="w-48"
          >
            <option value="">All buildings</option>
            {buildings.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Floor</Label>
          <Select
            value={floorFilter}
            onChange={(e) => {
              setFloorFilter(e.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="">All floors</option>
            {buildings.data?.map((b) => (
              <optgroup key={b.id} label={b.name}>
                {(b.floors || []).map((f: any) => (
                  <option key={f.id} value={f.id}>
                    Floor {f.number} · {f.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        {hotelFilter && (
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ['rooms'] })}
          >
            Refresh
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${DOT[STATUS_VARIANT[s]]}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <Separator />

      {rooms.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !rooms.data?.items.length ? (
        <p className="rounded-lg border bg-background py-10 text-center text-sm text-muted-foreground">
          No rooms match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rooms.data.items.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="group rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-bold">{r.roomNumber}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </div>
              <div className="mt-2 truncate text-sm font-medium">{r.roomType?.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {r.floor ? `Floor ${r.floor.number} · ${r.building?.name || '—'}` : r.building?.name || 'No floor'}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {rooms.data?.items?.length || 0} of {rooms.data?.total || 0} rooms
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm tabular-nums">
            {rooms.data?.page || page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      {selectedId && <RoomDialog roomId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} />}
    </div>
  );
}

function RoomDialog({ roomId, onOpenChange }: { roomId: string; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();

  const room = useQuery({
    queryKey: ['rooms', 'detail', roomId],
    queryFn: () => roomsApi.get(roomId),
  });

  const [statusDraft, setStatusDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockForm, setBlockForm] = useState({ reason: 'OTHER', startDate: todayISO(), endDate: '', note: '' });
  const [unblocking, setUnblocking] = useState('');

  useEffect(() => {
    if (room.data) setStatusDraft(room.data.status);
  }, [room.data]);

  const r = room.data;

  const updateStatus = async () => {
    if (!r || !statusDraft) return;
    setSavingStatus(true);
    try {
      await roomsApi.setStatus(r.id, { status: statusDraft });
      toast.success(`Room ${r.roomNumber} marked ${STATUS_LABEL[statusDraft]}`);
      qc.invalidateQueries({ queryKey: ['rooms'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const blockRoom = async () => {
    if (!r || !blockForm.startDate) {
      toast.error('Start date is required');
      return;
    }
    setBlocking(true);
    try {
      await roomsApi.block(r.id, {
        reason: blockForm.reason,
        startDate: blockForm.startDate,
        endDate: blockForm.endDate || undefined,
        note: blockForm.note || undefined,
      });
      toast.success(`Room ${r.roomNumber} blocked`);
      setBlockOpen(false);
      setBlockForm({ reason: 'OTHER', startDate: todayISO(), endDate: '', note: '' });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to block room');
    } finally {
      setBlocking(false);
    }
  };

  const unblockRoom = async (blockId: string) => {
    if (!r) return;
    setUnblocking(blockId);
    try {
      await roomsApi.unblock(r.id, blockId);
      toast.success('Block removed');
      qc.invalidateQueries({ queryKey: ['rooms'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove block');
    } finally {
      setUnblocking('');
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {r ? (
              <>
                Room {r.roomNumber}
                <Badge variant={STATUS_VARIANT[r.status]} className="ml-2 align-middle">
                  {STATUS_LABEL[r.status]}
                </Badge>
              </>
            ) : (
              'Room'
            )}
          </DialogTitle>
          <DialogDescription>{r?.notes || 'Room details and operations'}</DialogDescription>
        </DialogHeader>

        {room.isLoading || !r ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Room type</div>
                <div className="text-sm font-medium">{r.roomType?.name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Capacity</div>
                <div className="text-sm font-medium">
                  {r.roomType?.adultsCapacity ?? r.roomType?.capacity ?? '—'} adults
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Base rate</div>
                <div className="text-sm font-medium">{formatCurrency(Number(r.roomType?.basePrice))}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Building</div>
                <div className="text-sm font-medium">{r.building?.name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Floor</div>
                <div className="text-sm font-medium">{r.floor ? `Floor ${r.floor.number} · ${r.floor.name}` : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Housekeeping</div>
                <div className="text-sm font-medium">{r.housekeepingStatus || '—'}</div>
              </div>
            </div>

            {(r.roomType?.amenities?.length || 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.roomType.amenities.map((a: any) => (
                  <Badge key={a.id} variant="outline">
                    {a.name}
                  </Badge>
                ))}
              </div>
            )}

            {r.currentReservation && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium">Current reservation</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Guest</div>
                    <div className="font-medium">
                      {r.currentReservation.guest?.firstName} {r.currentReservation.guest?.lastName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reference</div>
                    <div>{r.currentReservation.confirmationNumber || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Check-in</div>
                    <div>{formatDate(r.currentReservation.checkInDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Check-out</div>
                    <div>{formatDate(r.currentReservation.checkOutDate)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border p-4">
              <Label>Operational status</Label>
              <p className="text-xs text-muted-foreground">OCCUPIED is set by front desk check-in, not here.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="w-52">
                  {SETTABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
                <Button onClick={updateStatus} disabled={savingStatus || statusDraft === r.status}>
                  {savingStatus ? 'Saving…' : 'Update status'}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Ban className="h-4 w-4" /> Blocks
                </div>
                <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}>
                  Block room
                </Button>
              </div>
              {(r.activeRoomBlocks || []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No active blocks.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {r.activeRoomBlocks.map((b: any) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{b.reason.replace(/_/g, ' ')}</span> ·{' '}
                        {formatDate(b.startDate)} → {b.endDate ? formatDate(b.endDate) : 'Open-ended'}
                        {b.note ? ` — ${b.note}` : ''}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={unblocking === b.id}
                        onClick={() => unblockRoom(b.id)}
                      >
                        {unblocking === b.id ? 'Removing…' : 'Unblock'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block room {r?.roomNumber}</DialogTitle>
            <DialogDescription>Takes the room out of inventory for the given dates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Select value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}>
                {REASONS.map((x) => (
                  <option key={x} value={x}>
                    {x.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>From</Label>
                <Input
                  type="date"
                  value={blockForm.startDate}
                  onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>To (optional)</Label>
                <Input
                  type="date"
                  value={blockForm.endDate}
                  onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Note</Label>
              <Textarea
                value={blockForm.note}
                onChange={(e) => setBlockForm({ ...blockForm, note: e.target.value })}
                placeholder="Optional details"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={blockRoom} disabled={blocking}>
              {blocking ? 'Blocking…' : 'Block room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}