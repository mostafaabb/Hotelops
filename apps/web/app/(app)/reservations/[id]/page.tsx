'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  DoorOpen,
  DoorClosed,
  Ban,
  XCircle,
  CheckCircle2,
  User,
  Building2,
  CalendarDays,
  Wallet,
  MessageSquarePlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  reservationsApi,
  foliosApi,
  frontDeskApi,
} from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';

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

function nightsBetween(a: string, b: string) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

export default function ReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeHotelId = useAuth((s) => s.activeHotelId);

  const id = params.id as string;

  const { data: r, isLoading } = useQuery({
    queryKey: ['reservations', id, activeHotelId],
    queryFn: () => reservationsApi.get(id),
    enabled: !!id,
  });

  const { data: folio } = useQuery({
    queryKey: ['folios', 'byReservation', id, activeHotelId],
    queryFn: () => foliosApi.byReservation(id),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reservations', id] });
    queryClient.invalidateQueries({ queryKey: ['folios', 'byReservation', id] });
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
  };

  const actionMutation = useMutation({
    mutationFn: ({ kind, reason }: { kind: 'checkin' | 'checkout' | 'noshow' | 'cancel'; reason?: string }) => {
      if (kind === 'checkin') return frontDeskApi.checkIn(r.id);
      if (kind === 'checkout') return frontDeskApi.checkOut(r.id);
      if (kind === 'noshow') return frontDeskApi.noShow(r.id, reason);
      return reservationsApi.cancel(r.id, { reason, refund: false });
    },
    onSuccess: () => {
      toast.success('Reservation updated');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || 'Action failed'),
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) => reservationsApi.addNote(id, note),
    onSuccess: () => {
      toast.success('Note added');
      setNote('');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add note'),
  });

  const [note, setNote] = useState('');
  const [actionDialog, setActionDialog] = useState<null | 'cancel'>(null);
  const [cancelReason, setCancelReason] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!r) return null;

  const nights = nightsBetween(r.checkInDate, r.checkOutDate);
  const canCheckIn = (r.status === 'CONFIRMED' || r.status === 'INQUIRY') && !!r.roomId;
  const canCheckOut = r.status === 'CHECKED_IN';
  const canNoShow = r.status === 'CONFIRMED' || r.status === 'INQUIRY';
  const canCancel = !['CANCELLED', 'CHECKED_OUT', 'COMPLETED', 'NO_SHOW'].includes(r.status);

  const entries = folio?.entries || [];
  const payments = folio?.payments || [];
  const outstanding = Number(folio?.balance ?? r.balance ?? 0);

  const activities = (r.activities || []).slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/reservations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{r.confirmationNumber}</h1>
              <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{statusLabel(r.status)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.guest?.firstName} {r.guest?.lastName} · {r.roomType?.name || 'No room type'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCheckIn && (
            <Button size="sm" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ kind: 'checkin' })}>
              <DoorOpen className="mr-1 h-4 w-4" />Check in
            </Button>
          )}
          {canCheckOut && (
            <Button size="sm" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ kind: 'checkout' })}>
              <DoorClosed className="mr-1 h-4 w-4" />Check out
            </Button>
          )}
          {canNoShow && (
            <Button size="sm" variant="outline" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ kind: 'noshow' })}>
              <Ban className="mr-1 h-4 w-4" />Mark no-show
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="destructive" onClick={() => setActionDialog('cancel')}>
              <XCircle className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Reservation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Check-in</dt>
                  <dd className="font-medium">{formatDate(r.checkInDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Check-out</dt>
                  <dd className="font-medium">{formatDate(r.checkOutDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nights</dt>
                  <dd className="font-medium">{nights}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Room</dt>
                  <dd className="font-medium">{r.room?.roomNumber || 'Not assigned'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Room type</dt>
                  <dd className="font-medium">{r.roomType?.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Guests</dt>
                  <dd className="font-medium">{r.adults} adult{r.adults !== 1 ? 's' : ''}{r.children > 0 ? `, ${r.children} child${r.children !== 1 ? 'ren' : ''}` : ''}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Rate plan</dt>
                  <dd className="font-medium">{r.ratePlan?.name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="font-medium">{r.source ? statusLabel(r.source) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-medium">{formatDateTime(r.createdAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Guest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                  {r.guest?.firstName?.charAt(0)}{r.guest?.lastName?.charAt(0)}
                </div>
                <div>
                  <div className="text-lg font-semibold">{r.guest?.firstName} {r.guest?.lastName}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.guest?.email && <span>{r.guest.email} · </span>}
                    {r.guest?.phone || '—'}
                    {r.guest?.isVip && <Badge variant="warning" className="ml-2">VIP</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> Stay Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Room revenue ({nights} night{nights !== 1 ? 's' : ''})</span><span>{formatCurrency(r.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span>{formatCurrency(r.taxes)}</span></div>
                {Number(r.discounts) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Discounts</span><span>-{formatCurrency(r.discounts)}</span></div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatCurrency(r.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{formatCurrency(r.amountPaid)}</span></div>
                <div className={`flex justify-between font-medium ${Number(outstanding) > 0 ? 'text-destructive' : ''}`}>
                  <span>Balance</span><span>{formatCurrency(outstanding)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {activities.map((a: any) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <div>{a.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(a.performedAt)}
                          {a.performedByUser && ` · ${a.performedByUser.firstName} ${a.performedByUser.lastName}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus className="h-4 w-4" /> Add note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input placeholder="Note for this reservation" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button disabled={!note.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate(note.trim())}>
                  {addNoteMutation.isPending ? 'Saving...' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Folio</span>
                <Badge variant={Number(outstanding) > 0 ? 'destructive' : 'success'}>
                  {formatCurrency(outstanding)} {Number(outstanding) > 0 ? 'due' : 'settled'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Charges & payments</div>
                {entries.length === 0 && payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No folio activity yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="text-sm">{e.description}</div>
                            <div className="text-xs text-muted-foreground">{statusLabel(e.type)}</div>
                          </TableCell>
                          <TableCell className={`text-right text-sm ${Number(e.amount) < 0 ? 'text-emerald-600' : ''}`}>
                            {Number(e.amount) < 0 ? '-' : ''}{formatCurrency(Math.abs(Number(e.amount)) + Number(e.taxAmount || 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                      {payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="text-sm">Payment — {statusLabel(p.method)}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.reference && <span>{p.reference} · </span>}
                              {formatDateTime(p.paymentDate || p.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-emerald-600">-{formatCurrency(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid amount</span>
                <span>{formatCurrency(folio?.paidAmount ?? r.amountPaid)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={actionDialog === 'cancel'} onOpenChange={(o) => { if (!o) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Reason</Label>
            <Input placeholder="Reason for cancellation" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              This will mark the reservation as cancelled. Balance will be zeroed.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={actionMutation.isPending}
              onClick={() => {
                actionMutation.mutate({ kind: 'cancel', reason: cancelReason || undefined });
                setActionDialog(null);
              }}
            >
              Cancel reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}