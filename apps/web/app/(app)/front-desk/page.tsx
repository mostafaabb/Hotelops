'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BedDouble,
  CalendarCheck,
  DoorOpen,
  Hotel,
  UserX,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { frontDeskApi, reservationsApi, roomsApi, ApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  INQUIRY: 'Inquiry',
  CHECKED_IN: 'In-house',
  CHECKED_OUT: 'Checked out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
  COMPLETED: 'Completed',
};

function statusVariant(status: string) {
  switch (status) {
    case 'CHECKED_IN':
      return 'default' as const;
    case 'CONFIRMED':
      return 'secondary' as const;
    case 'INQUIRY':
      return 'outline' as const;
    case 'NO_SHOW':
    case 'CANCELLED':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

function canCheckIn(r: any) {
  return (r.status === 'CONFIRMED' || r.status === 'INQUIRY') && !!r.roomId;
}

function canCheckOut(r: any) {
  return r.status === 'CHECKED_IN';
}

function canNoShow(r: any) {
  return r.status === 'CONFIRMED' || r.status === 'INQUIRY';
}

function errorMessage(e: any) {
  if (e instanceof ApiError) return e.message;
  return e?.message || 'Something went wrong';
}

export default function FrontDeskPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const queryClient = useQueryClient();
  const [action, setAction] = useState<{ type: 'checkin' | 'checkout' | 'noshow'; reservation: any } | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const board = useQuery({
    queryKey: ['front-desk', activeHotelId],
    queryFn: () => frontDeskApi.board(activeHotelId ? { hotelId: activeHotelId } : {}),
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['front-desk', activeHotelId] });
  };

  const checkIn = useMutation({
    mutationFn: (reservationId: string) => frontDeskApi.checkIn(reservationId),
    onSuccess: () => {
      toast.success('Guest checked in');
      setAction(null);
      invalidate();
    },
    onError: (e: any) => toast.error(errorMessage(e)),
  });

  const checkOut = useMutation({
    mutationFn: (reservationId: string) => frontDeskApi.checkOut(reservationId),
    onSuccess: () => {
      toast.success('Guest checked out');
      setAction(null);
      invalidate();
    },
    onError: (e: any) => toast.error(errorMessage(e)),
  });

  const noShow = useMutation({
    mutationFn: (args: { reservationId: string; reason?: string }) => frontDeskApi.noShow(args.reservationId, args.reason),
    onSuccess: () => {
      toast.success('Reservation marked as no-show');
      setAction(null);
      invalidate();
    },
    onError: (e: any) => toast.error(errorMessage(e)),
  });

  const b = board.data;
  const counts = b?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Front Desk</h1>
          <p className="text-sm text-muted-foreground">
            {b?.date ? new Date(b.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
          </p>
        </div>
        <Button onClick={() => setWalkInOpen(true)}>
          <Plus className="h-4 w-4" />
          Walk-in
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Arrivals today', value: counts?.arrivalsCount, icon: ArrowDownToLine, hint: 'Expected check-ins' },
          { label: 'Departures today', value: counts?.departuresCount, icon: ArrowUpFromLine, hint: 'Expected check-outs' },
          { label: 'In-house guests', value: counts?.inHouseCount, icon: BedDouble, hint: `${counts?.occupiedRooms ?? '—'} rooms occupied` },
          { label: 'Available rooms', value: counts?.availableRooms, icon: Hotel, hint: `${counts?.totalRooms ?? '—'} rooms total` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {kpi.value === undefined ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section
          title="Arrivals"
          description="Checking in today"
          icon={ArrowDownToLine}
          count={counts?.arrivalsCount}
          loading={board.isLoading}
          items={b?.arrivals || []}
          renderActions={(r: any) => (
            <RowActions
              r={r}
              onCheckIn={() => setAction({ type: 'checkin', reservation: r })}
              onCheckOut={() => setAction({ type: 'checkout', reservation: r })}
              onNoShow={() => setAction({ type: 'noshow', reservation: r })}
            />
          )}
          meta={(r: any) => (
            <div className="text-xs text-muted-foreground">
              {r.checkInDate ? `Arriving ${formatDate(r.checkInDate)}` : 'No room assigned'}
            </div>
          )}
        />
        <Section
          title="In-house"
          description="Currently checked in"
          icon={BedDouble}
          count={counts?.inHouseCount}
          loading={board.isLoading}
          items={b?.currentGuests || []}
          renderActions={(r: any) => (
            <RowActions
              r={r}
              onCheckIn={() => setAction({ type: 'checkin', reservation: r })}
              onCheckOut={() => setAction({ type: 'checkout', reservation: r })}
              onNoShow={() => setAction({ type: 'noshow', reservation: r })}
            />
          )}
          meta={(r: any) => (
            <div className="text-xs text-muted-foreground">
              {r.folio?.balance != null ? <>Folio {formatCurrency(Number(r.folio.balance))}</> : r.room?.roomNumber ?? 'No room'}
            </div>
          )}
        />
        <Section
          title="Departures"
          description="Checking out today"
          icon={ArrowUpFromLine}
          count={counts?.departuresCount}
          loading={board.isLoading}
          items={b?.departures || []}
          renderActions={(r: any) => (
            <RowActions
              r={r}
              onCheckIn={() => setAction({ type: 'checkin', reservation: r })}
              onCheckOut={() => setAction({ type: 'checkout', reservation: r })}
              onNoShow={() => setAction({ type: 'noshow', reservation: r })}
            />
          )}
          meta={(r: any) => (
            <div className="text-xs text-muted-foreground">
              {r.checkOutDate ? `Departing ${formatDate(r.checkOutDate)}` : ''}
            </div>
          )}
        />
      </div>

      <ConfirmActionDialog action={action} onClose={() => setAction(null)} checkIn={checkIn} checkOut={checkOut} noShow={noShow} />

      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        hotelId={activeHotelId}
        invalidate={invalidate}
      />
    </div>
  );
}

function Section({ title, description, icon: Icon, count, loading, items, renderActions, meta }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {loading ? (
          <Skeleton className="h-6 w-8" />
        ) : (
          <Badge variant="secondary">{count ?? 0}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <CalendarCheck className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          </div>
        ) : (
          items.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {r.guest?.firstName} {r.guest?.lastName}
                  </span>
                  <Badge variant={statusVariant(r.status)} className="shrink-0">
                    {RESERVATION_STATUS_LABEL[r.status] || r.status}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3 w-3" />
                    {r.room?.roomNumber || 'No room'}
                  </span>
                  <span>{r.confirmationNumber}</span>
                </div>
                {meta(r)}
              </div>
              <div className="flex shrink-0 items-center gap-2">{renderActions(r)}</div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RowActions({ r, onCheckIn, onCheckOut, onNoShow }: any) {
  if (canCheckIn(r)) {
    return (
      <>
        <Button size="sm" onClick={onCheckIn}>
          <DoorOpen className="h-3.5 w-3.5" />
          Check in
        </Button>
        <Button size="sm" variant="outline" onClick={onNoShow}>
          <UserX className="h-3.5 w-3.5" />
          No-show
        </Button>
      </>
    );
  }
  if (canCheckOut(r)) {
    return (
      <Button size="sm" variant="outline" onClick={onCheckOut}>
        <ArrowUpFromLine className="h-3.5 w-3.5" />
        Check out
      </Button>
    );
  }
  return <span className="text-xs text-muted-foreground">No actions</span>;
}

function ConfirmActionDialog({ action: a, onClose, checkIn, checkOut, noShow }: any) {
  const pending = checkIn.isPending || checkOut.isPending || noShow.isPending;
  if (!a) return null;
  const reservation = a.reservation;
  const guestName = `${reservation.guest?.firstName} ${reservation.guest?.lastName}`;

  const config: Record<
    string,
    { title: string; description: string; confirmLabel: string; destructive: boolean; onConfirm: () => void }
  > = {
    checkin: {
      title: 'Check in guest',
      description: `Check in ${guestName} to Room ${reservation.room?.roomNumber || '—'}?`,
      confirmLabel: 'Check in',
      destructive: false,
      onConfirm: () => checkIn.mutate(reservation.id),
    },
    checkout: {
      title: 'Check out guest',
      description: `Check out ${guestName} from Room ${reservation.room?.roomNumber || '—'}? An invoice will be generated for the folio balance.`,
      confirmLabel: 'Check out',
      destructive: false,
      onConfirm: () => checkOut.mutate(reservation.id),
    },
    noshow: {
      title: 'Mark as no-show',
      description: `Mark the reservation for ${guestName} as no-show?`,
      confirmLabel: 'Mark no-show',
      destructive: true,
      onConfirm: () => noShow.mutate({ reservationId: reservation.id }),
    },
  };

  const c = config[a.type];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant={c.destructive ? 'destructive' : 'default'} disabled={pending} onClick={c.onConfirm}>
            {pending ? 'Working…' : c.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const walkInSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  roomId: z.string().min(1, 'Select a room'),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  adults: z.coerce.number().int().min(1, 'At least one adult'),
  children: z.coerce.number().int().min(0).max(20),
});

type WalkInForm = z.infer<typeof walkInSchema>;

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function WalkInDialog({ open, onOpenChange, hotelId, invalidate }: any) {
  const defaultToday = toDateInput(new Date());
  const defaultTomorrow = toDateInput(new Date(Date.now() + 86400000));

  const form = useForm<WalkInForm>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      roomId: '',
      checkInDate: defaultToday,
      checkOutDate: defaultTomorrow,
      adults: 1,
      children: 0,
    },
  });

  const rooms = useQuery({
    queryKey: ['rooms', 'walk-in', hotelId],
    queryFn: () => roomsApi.list({ hotelId: hotelId || undefined, pageSize: 100, status: 'AVAILABLE' }),
  });

  const createWalkIn = useMutation({
    mutationFn: (data: WalkInForm) =>
      reservationsApi.walkIn({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        roomId: data.roomId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        adults: data.adults,
        children: data.children,
      }),
    onSuccess: () => {
      toast.success('Walk-in reservation created');
      form.reset();
      onOpenChange(false);
      invalidate();
    },
    onError: (e: any) => toast.error(errorMessage(e)),
  });

  const roomItems = rooms.data?.items || [];
  const checkIn = form.watch('checkInDate');
  const checkOut = form.watch('checkOutDate');
  const datesInvalid = !!checkIn && !!checkOut && new Date(checkOut) <= new Date(checkIn);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Walk-in reservation</DialogTitle>
          <DialogDescription>Create a same-day reservation and check the guest in.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit((data) => createWalkIn.mutate(data))}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" placeholder="Marco" {...form.register('firstName')} />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" placeholder="Rossi" {...form.register('lastName')} />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="guest@example.com" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+1 555 000 0000" {...form.register('phone')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roomId">Room</Label>
            {rooms.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select id="roomId" {...form.register('roomId')}>
                <option value="" disabled>
                  Select an available room
                </option>
                {roomItems.length === 0 ? (
                  <option value="" disabled>
                    No available rooms
                  </option>
                ) : (
                  roomItems.map((room: any) => (
                    <option key={room.id} value={room.id}>
                      {room.roomNumber} — {room.roomType?.name || 'Room'}
                    </option>
                  ))
                )}
              </Select>
            )}
            {form.formState.errors.roomId && (
              <p className="text-xs text-destructive">{form.formState.errors.roomId.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkInDate">Check-in</Label>
              <Input id="checkInDate" type="date" {...form.register('checkInDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkOutDate">Check-out</Label>
              <Input id="checkOutDate" type="date" {...form.register('checkOutDate')} />
              {datesInvalid && <p className="text-xs text-destructive">Check-out must be after check-in</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adults">Adults</Label>
              <Input id="adults" type="number" min={1} {...form.register('adults')} />
              {form.formState.errors.adults && (
                <p className="text-xs text-destructive">{form.formState.errors.adults.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="children">Children</Label>
              <Input id="children" type="number" min={0} {...form.register('children')} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={createWalkIn.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createWalkIn.isPending || datesInvalid}>
              {createWalkIn.isPending ? 'Creating…' : 'Create reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}