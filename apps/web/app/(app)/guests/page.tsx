'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { guestsApi } from '@/lib/api';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PAGE_SIZE = 20;

const VIP_VARIANT = {
  true: 'warning',
  false: 'muted',
} as any;

const RES_STATUS_VARIANT: Record<string, any> = {
  INQUIRY: 'secondary',
  CONFIRMED: 'info',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'muted',
  CANCELLED: 'destructive',
  NO_SHOW: 'warning',
  COMPLETED: 'success',
};

export default function GuestsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const guests = useQuery({
    queryKey: ['guests', activeHotelId, search, vipFilter, page],
    queryFn: () =>
      guestsApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        isVip: vipFilter || undefined,
        hotelId: activeHotelId || undefined,
      }),
  });

  const items: any[] = guests.data?.items || [];
  const totalPages = guests.data ? Math.max(1, Math.ceil(guests.data.total / PAGE_SIZE)) : 1;

  const toggleVip = async (g: any, isVip: boolean) => {
    try {
      await guestsApi.setVip(g.id, { isVip });
      toast.success(isVip ? `${g.firstName} ${g.lastName} marked as VIP` : 'VIP removed');
      qc.invalidateQueries({ queryKey: ['guests'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update VIP status');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await guestsApi.remove(deleting.id);
      toast.success('Guest removed');
      qc.invalidateQueries({ queryKey: ['guests'] });
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove guest');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guests</h1>
          <p className="text-sm text-muted-foreground">Guest directory and profiles</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> New guest
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-72 pl-8"
              placeholder="Name, email or phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>VIP</Label>
          <Select
            className="w-40"
            value={vipFilter}
            onChange={(e) => {
              setVipFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All guests</option>
            <option value="true">VIP only</option>
            <option value="false">Non-VIP</option>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {guests.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No guests match the current filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">VIP</TableHead>
                <TableHead className="text-right">Reservations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((g) => (
                <TableRow key={g.id} className="cursor-pointer" onClick={() => setDetailId(g.id)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials(g.firstName, g.lastName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {g.firstName} {g.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(g.createdAt)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{g.email || '—'}</div>
                    <div className="text-xs text-muted-foreground">{g.phone || '—'}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    {g.isVip ? <Crown className="mx-auto h-4 w-4 text-amber-500" /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g._count?.reservations ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={g.status === 'ACTIVE' ? 'success' : 'muted'}>{g.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setDetailId(g.id)}>
                          <UserRound className="h-4 w-4" /> View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(g);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleVip(g, !g.isVip)}>
                          <Crown className="h-4 w-4" /> {g.isVip ? 'Remove VIP' : 'Mark as VIP'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(g)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
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
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {guests.data?.total || 0} guests
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm tabular-nums">
            {guests.data?.page || page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      {detailId && <GuestDetailDialog guestId={detailId} onOpenChange={(o) => !o && setDetailId(null)} />}

      {(formOpen || editing) && (
        <GuestForm
          initial={editing}
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove guest?</DialogTitle>
            <DialogDescription>
              The guest will be marked inactive. Past stays are kept for history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletingBusy}>
              {deletingBusy ? 'Removing…' : 'Remove guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuestDetailDialog({ guestId, onOpenChange }: { guestId: string; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();

  const guest = useQuery({
    queryKey: ['guests', 'detail', guestId],
    queryFn: () => guestsApi.get(guestId),
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

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {g ? `${g.firstName} ${g.lastName}` : 'Guest'}
            {g?.isVip && (
              <Badge variant="warning">
                <Crown className="mr-1 h-3 w-3" /> VIP
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{g?.email || 'Guest profile'}</DialogDescription>
        </DialogHeader>

        {guest.isLoading || !g ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="text-sm font-medium">{g.phone || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Nationality</div>
                <div className="text-sm font-medium">{g.nationality || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Date of birth</div>
                <div className="text-sm font-medium">{formatDate(g.dateOfBirth)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Crown className="h-4 w-4 text-amber-500" /> VIP status
                </div>
                <p className="text-xs text-muted-foreground">VIPs get priority service.</p>
              </div>
              <Switch checked={!!g.isVip} onCheckedChange={(c) => toggleVip(!!c)} />
            </div>

            {g.preferences && (
              <div>
                <div className="text-sm font-medium">Preferences</div>
                <p className="mt-1 text-sm text-muted-foreground">{g.preferences}</p>
              </div>
            )}
            {g.specialRequests && (
              <div>
                <div className="text-sm font-medium">Special requests</div>
                <p className="mt-1 text-sm text-muted-foreground">{g.specialRequests}</p>
              </div>
            )}
            {g.notes && (
              <div>
                <div className="text-sm font-medium">Notes</div>
                <p className="mt-1 text-sm text-muted-foreground">{g.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-xl font-bold">{g.stats?.totalStays ?? 0}</div>
                <div className="text-xs text-muted-foreground">Total stays</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xl font-bold">{formatCurrency(g.stats?.totalSpent)}</div>
                <div className="text-xs text-muted-foreground">Total spent</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xl font-bold">{g.stats?.averageStay ?? 0}</div>
                <div className="text-xs text-muted-foreground">Avg stay (nights)</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xl font-bold">{formatDate(g.stats?.lastVisit)}</div>
                <div className="text-xs text-muted-foreground">Last visit</div>
              </div>
            </div>

            {(g.reservations || []).length > 0 && (
              <div>
                <div className="text-sm font-medium">Recent reservations</div>
                <div className="mt-2 space-y-2">
                  {g.reservations.slice(0, 6).map((res: any) => (
                    <div key={res.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{res.confirmationNumber}</span>
                        <span className="ml-2 text-muted-foreground">
                          {res.room?.roomNumber ? `Room ${res.room.roomNumber}` : res.roomType?.name || ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                        </span>
                        <Badge variant={RES_STATUS_VARIANT[res.status] || 'outline'}>{res.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" asChild>
                <Link href={`/guests/${g.id}`}>Open full profile</Link>
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GuestForm({
  initial,
  open,
  onOpenChange,
}: {
  initial: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: initial?.firstName || '',
    lastName: initial?.lastName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    dateOfBirth: initial?.dateOfBirth ? initial.dateOfBirth.slice(0, 10) : '',
    nationality: initial?.nationality || '',
    gender: initial?.gender || '',
    isVip: initial?.isVip || false,
    notes: initial?.notes || '',
    preferences: initial?.preferences || '',
    specialRequests: initial?.specialRequests || '',
  });

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.firstName || !form.lastName) {
      toast.error('First and last name are required');
      return;
    }
    const body = {
      ...form,
      email: form.email || undefined,
      phone: form.phone || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      nationality: form.nationality || undefined,
      gender: form.gender || undefined,
      notes: form.notes || undefined,
      preferences: form.preferences || undefined,
      specialRequests: form.specialRequests || undefined,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await guestsApi.update(initial.id, body);
        toast.success('Guest updated');
      } else {
        await guestsApi.create(body);
        toast.success('Guest created');
      }
      qc.invalidateQueries({ queryKey: ['guests'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save guest');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit guest' : 'New guest'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update ${initial.firstName} ${initial.lastName}` : 'Add a guest to the directory'}
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
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
              />
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
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-amber-500" /> VIP guest
            </div>
            <Switch checked={form.isVip} onCheckedChange={(c) => set('isVip', !!c)} />
          </div>
          <div className="grid gap-2">
            <Label>Preferences</Label>
            <Textarea value={form.preferences} onChange={(e) => set('preferences', e.target.value)} placeholder="Room preferences, allergies, etc." />
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
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create guest'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}