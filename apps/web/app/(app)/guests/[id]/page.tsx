'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Crown, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { guestsApi } from '@/lib/api';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { useAuth } from '@/store/auth';

const RES_STATUS_VARIANT: Record<string, any> = {
  INQUIRY: 'secondary',
  CONFIRMED: 'info',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'muted',
  CANCELLED: 'destructive',
  NO_SHOW: 'warning',
  COMPLETED: 'success',
};

export default function GuestProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);

  const guest = useQuery({
    queryKey: ['guests', 'detail', id, activeHotelId],
    queryFn: () => guestsApi.get(id),
    enabled: !!id,
  });

  const history = useQuery({
    queryKey: ['guests', 'history', id, activeHotelId],
    queryFn: () => guestsApi.history(id),
    enabled: !!id,
  });

  const g = guest.data;

  const toggleVip = async (isVip: boolean) => {
    if (!g) return;
    try {
      await guestsApi.setVip(g.id, { isVip });
      toast.success(isVip ? 'Marked as VIP' : 'VIP removed');
      qc.invalidateQueries({ queryKey: ['guests'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update VIP status');
    }
  };

  if (guest.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!g) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Guest not found.</p>
        <Button variant="outline" asChild>
          <Link href="/guests">Back to guests</Link>
        </Button>
      </div>
    );
  }

  const prevStays: any[] = history.data?.previousStays || [];
  const upcoming: any[] = history.data?.upcomingReservations || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/guests">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials(g.firstName, g.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {g.firstName} {g.lastName}
              </h1>
              {g.isVip && (
                <Badge variant="warning">
                  <Crown className="mr-1 h-3 w-3" /> VIP
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {g.email || g.phone || 'No contact info'} · Member since {formatDate(g.createdAt)}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Crown className="h-4 w-4 text-amber-500" /> VIP status
        </div>
        <Switch checked={!!g.isVip} onCheckedChange={(c) => toggleVip(!!c)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Contact and demographic information</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div>{g.phone || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div>{g.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nationality</div>
              <div>{g.nationality || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Date of birth</div>
              <div>{formatDate(g.dateOfBirth)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Gender</div>
              <div>{g.gender || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Address</div>
              <div>
                {[g.address, g.city, g.country].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences & notes</CardTitle>
            <CardDescription>Guest-provided details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Preferences</div>
              <p>{g.preferences || 'No preferences recorded.'}</p>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Special requests</div>
              <p>{g.specialRequests || 'None.'}</p>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Notes</div>
              <p>{g.notes || 'No notes.'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lifetime totals</CardTitle>
            <CardDescription>From completed stays</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total stays</span>
              <span className="font-medium">{g.stats?.totalStays ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total spent</span>
              <span className="font-medium">{formatCurrency(g.stats?.totalSpent)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Average stay</span>
              <span className="font-medium">{g.stats?.averageStay ?? 0} nights</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last visit</span>
              <span className="font-medium">{formatDate(g.stats?.lastVisit)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={g.status === 'ACTIVE' ? 'success' : 'muted'}>{g.status}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {history.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Stays & history</CardTitle>
            <CardDescription>
              {prevStays.length} completed stays · {history.data ? formatCurrency(history.data.totalSpent) : '—'} total spent ·{' '}
              {history.data?.averageStay ?? 0} nights avg
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {upcoming.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium">Upcoming reservations</div>
                <ReservationTable rows={upcoming} />
              </div>
            )}
            <div>
              <div className="mb-2 text-sm font-medium">Previous stays</div>
              {prevStays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completed stays yet.</p>
              ) : (
                <ReservationTable rows={prevStays} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {editOpen && (
        <ProfileEditForm guest={g} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </div>
  );
}

function ReservationTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.confirmationNumber}</TableCell>
              <TableCell>
                {r.room?.roomNumber ? `Room ${r.room.roomNumber}` : r.roomType?.name || '—'}
              </TableCell>
              <TableCell>
                {formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}
              </TableCell>
              <TableCell>
                <Badge variant={RES_STATUS_VARIANT[r.status] || 'outline'}>{r.status}</Badge>
              </TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(Number(r.total))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProfileEditForm({
  guest,
  open,
  onOpenChange,
}: {
  guest: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email || '',
    phone: guest.phone || '',
    dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.slice(0, 10) : '',
    nationality: guest.nationality || '',
    gender: guest.gender || '',
    notes: guest.notes || '',
    preferences: guest.preferences || '',
    specialRequests: guest.specialRequests || '',
  });

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      await guestsApi.update(guest.id, {
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        nationality: form.nationality || undefined,
        gender: form.gender || undefined,
        notes: form.notes || undefined,
        preferences: form.preferences || undefined,
        specialRequests: form.specialRequests || undefined,
      });
      toast.success('Guest updated');
      qc.invalidateQueries({ queryKey: ['guests'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update guest');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit guest</DialogTitle>
          <DialogDescription>
            {guest.firstName} {guest.lastName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>First name</Label>
              <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Date of birth</Label>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Nationality</Label>
              <Input value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Gender</Label>
              <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Preferences</Label>
            <Textarea value={form.preferences} onChange={(e) => set('preferences', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Special requests</Label>
            <Textarea value={form.specialRequests} onChange={(e) => set('specialRequests', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}