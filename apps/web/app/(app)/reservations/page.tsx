'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, UserPlus, Search, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
import { Separator } from '@/components/ui/separator';
import { reservationsApi, guestsApi, roomTypesApi, ratePlansApi, roomsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'INQUIRY', label: 'Inquiry' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'CHECKED_OUT', label: 'Checked out' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'COMPLETED', label: 'Completed' },
];

const STATUS_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'muted' | 'secondary'> = {
  INQUIRY: 'muted',
  CONFIRMED: 'success',
  CHECKED_IN: 'info',
  CHECKED_OUT: 'secondary',
  CANCELLED: 'destructive',
  NO_SHOW: 'warning',
  COMPLETED: 'secondary',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const createSchema = z.object({
  guestId: z.string().min(1, 'Guest is required'),
  roomTypeId: z.string().min(1, 'Room type is required'),
  ratePlanId: z.string().optional(),
  checkInDate: z.string().min(1, 'Check-in is required'),
  checkOutDate: z.string().min(1, 'Check-out is required'),
  adults: z.coerce.number().min(1).default(1),
  children: z.coerce.number().min(0).default(0),
  source: z.string().optional(),
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export default function ReservationsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', activeHotelId, search, status, dateFrom, dateTo, page],
    queryFn: () =>
      reservationsApi.list({
        ...(activeHotelId ? { hotelId: activeHotelId } : {}),
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
        page,
        pageSize: 20,
      }),
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
          <p className="text-sm text-muted-foreground">{total} reservation{total !== 1 ? 's' : ''} found</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><UserPlus className="mr-2 h-4 w-4" />Walk-in</Button>
            </DialogTrigger>
            <WalkInDialog onClose={() => setWalkInOpen(false)} hotelId={activeHotelId} />
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New reservation</Button>
            </DialogTrigger>
            <CreateDialog onClose={() => setCreateOpen(false)} hotelId={activeHotelId} />
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Confirmation #, guest, room..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Status</Label>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>
            {(search || status || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); }}
              >
                <X className="mr-1 h-3 w-3" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No reservations found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Confirmation</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">{r.confirmationNumber}</TableCell>
                    <TableCell>{r.guest?.firstName} {r.guest?.lastName}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell>{r.room?.roomNumber || '—'}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.checkInDate)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.checkOutDate)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(r.total)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(r.amountPaid)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/reservations/${r.confirmationNumber}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateDialog({ onClose, hotelId }: { onClose: () => void; hotelId: string | null }) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { adults: 1, children: 0 },
  });

  const [guestSearch, setGuestSearch] = useState('');
  const selectedGuestId = watch('guestId');

  const { data: guestsData } = useQuery({
    queryKey: ['guests', 'picker', guestSearch],
    queryFn: () => guestsApi.list({ search: guestSearch, pageSize: 50 }),
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: () => roomTypesApi.list(),
  });

  const { data: ratePlans } = useQuery({
    queryKey: ['ratePlans'],
    queryFn: () => ratePlansApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => reservationsApi.create(body),
    onSuccess: () => {
      toast.success('Reservation created');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create reservation'),
  });

  const onSubmit = (form: CreateForm) => {
    createMutation.mutate({
      guestId: form.guestId,
      roomTypeId: form.roomTypeId,
      ratePlanId: form.ratePlanId || undefined,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: form.adults,
      children: form.children,
      source: form.source || undefined,
      specialRequests: form.specialRequests || undefined,
      notes: form.notes || undefined,
      ...(hotelId ? { hotelId } : {}),
    });
  };

  const guests = guestsData?.items || [];

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Reservation</DialogTitle>
        <DialogDescription>Create a new reservation with room assignment.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs">Guest *</Label>
          <Input
            placeholder="Search guest name..."
            value={guestSearch}
            onChange={(e) => setGuestSearch(e.target.value)}
            className="mb-1"
          />
          <Select {...register('guestId')}>
            <option value="">Select guest</option>
            {guests.map((g: any) => (
              <option key={g.id} value={g.id}>{g.firstName} {g.lastName}</option>
            ))}
          </Select>
          {errors.guestId && <p className="text-xs text-destructive mt-1">{errors.guestId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-xs">Check-in *</Label>
            <Input type="date" {...register('checkInDate')} />
            {errors.checkInDate && <p className="text-xs text-destructive mt-1">{errors.checkInDate.message}</p>}
          </div>
          <div>
            <Label className="mb-1 block text-xs">Check-out *</Label>
            <Input type="date" {...register('checkOutDate')} />
            {errors.checkOutDate && <p className="text-xs text-destructive mt-1">{errors.checkOutDate.message}</p>}
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs">Room type *</Label>
          <Select {...register('roomTypeId')}>
            <option value="">Select room type</option>
            {(roomTypes || []).map((rt: any) => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </Select>
          {errors.roomTypeId && <p className="text-xs text-destructive mt-1">{errors.roomTypeId.message}</p>}
        </div>

        <div>
          <Label className="mb-1 block text-xs">Rate plan</Label>
          <Select {...register('ratePlanId')}>
            <option value="">Select rate plan</option>
            {(ratePlans || []).map((rp: any) => (
              <option key={rp.id} value={rp.id}>{rp.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-xs">Adults *</Label>
            <Input type="number" min={1} {...register('adults')} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Children</Label>
            <Input type="number" min={0} {...register('children')} />
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs">Source</Label>
          <Select {...register('source')}>
            <option value="">Default</option>
            <option value="DIRECT">Direct</option>
            <option value="PHONE">Phone</option>
            <option value="WEBSITE">Website</option>
            <option value="BOOKING_PLATFORM">Booking platform</option>
            <option value="TRAVEL_AGENT">Travel agent</option>
            <option value="CORPORATE">Corporate</option>
          </Select>
        </div>

        <div>
          <Label className="mb-1 block text-xs">Special requests</Label>
          <Input {...register('specialRequests')} placeholder="Optional" />
        </div>

        <div>
          <Label className="mb-1 block text-xs">Notes</Label>
          <Input {...register('notes')} placeholder="Optional" />
        </div>

        <Separator />

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create reservation'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function WalkInDialog({ onClose, hotelId }: { onClose: () => void; hotelId: string | null }) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', roomId: '', checkInDate: '', checkOutDate: '', adults: 1, children: 0, ratePlanId: '' },
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms', 'walkin', hotelId],
    queryFn: () => roomsApi.list({ hotelId: hotelId || undefined, pageSize: 200 }),
  });

  const { data: ratePlans } = useQuery({
    queryKey: ['ratePlans'],
    queryFn: () => ratePlansApi.list(),
  });

  const walkInMutation = useMutation({
    mutationFn: (body: any) => reservationsApi.walkIn(body),
    onSuccess: () => {
      toast.success('Walk-in reservation created');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create walk-in'),
  });

  const onSubmit = (form: any) => {
    walkInMutation.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      roomId: form.roomId,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: Number(form.adults),
      children: Number(form.children),
      ratePlanId: form.ratePlanId || undefined,
    });
  };

  const rooms = roomsData?.items || [];

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Walk-in Reservation</DialogTitle>
        <DialogDescription>Create an immediate walk-in reservation.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-xs">First name *</Label>
            <Input {...register('firstName', { required: true })} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Last name *</Label>
            <Input {...register('lastName', { required: true })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-xs">Email</Label>
            <Input type="email" {...register('email')} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Phone</Label>
            <Input {...register('phone')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-xs">Check-in *</Label>
            <Input type="date" {...register('checkInDate', { required: true })} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Check-out *</Label>
            <Input type="date" {...register('checkOutDate', { required: true })} />
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs">Room *</Label>
          <Select {...register('roomId', { required: true })}>
            <option value="">Select room</option>
            {rooms.map((r: any) => (
              <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label className="mb-1 block text-xs">Rate plan</Label>
          <Select {...register('ratePlanId')}>
            <option value="">Select rate plan</option>
            {(ratePlans || []).map((rp: any) => (
              <option key={rp.id} value={rp.id}>{rp.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-xs">Adults</Label>
            <Input type="number" min={1} {...register('adults')} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Children</Label>
            <Input type="number" min={0} {...register('children')} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={walkInMutation.isPending}>
            {walkInMutation.isPending ? 'Creating...' : 'Create walk-in'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
