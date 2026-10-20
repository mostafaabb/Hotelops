'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, MapPin, Pencil, Phone, Plus, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { vendorsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/store/auth';

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactPerson: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Invalid email address')]).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

function vendorDefaults(initial?: any): VendorFormValues {
  return initial
    ? {
        name: initial.name || '',
        contactPerson: initial.contactPerson || '',
        email: initial.email || '',
        phone: initial.phone || '',
        address: initial.address || '',
        category: initial.category || '',
        notes: initial.notes || '',
        status: initial.status || 'ACTIVE',
      }
    : {
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        category: '',
        notes: '',
        status: 'ACTIVE',
      };
}

export default function VendorsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const vendors = useQuery({
    queryKey: ['vendors', activeHotelId],
    queryFn: () => vendorsApi.list({ pageSize: 200, ...(activeHotelId ? { hotelId: activeHotelId } : {}) }),
  });

  const res: any = vendors.data;
  const items: any[] = res?.items || [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (v: any) => {
    setEditing(v);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await vendorsApi.remove(deleting.id);
      toast.success(`Vendor "${deleting.name}" deactivated`);
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to deactivate vendor');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">Suppliers and their profile information</p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> New vendor
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {vendors.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <Store className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No vendors yet. Add your first supplier.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="font-medium">{v.name}</div>
                    {v.notes && <div className="text-xs text-muted-foreground">{v.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.contactPerson || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.email ? (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {v.email}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.phone ? (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {v.phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.address ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {v.address}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {v.category ? <Badge variant="outline">{v.category}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="tabular-nums">{v.expenseCount ?? 0}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(Number(v.totalExpenses) || 0)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.status === 'ACTIVE' ? 'success' : 'muted'}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(v)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {(formOpen || editing) && (
        <VendorForm
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
            <DialogTitle>Deactivate vendor?</DialogTitle>
            <DialogDescription>
              "{deleting?.name}" will be marked inactive. Existing history is kept and the vendor can be re-activated later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletingBusy}>
              {deletingBusy ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VendorForm({
  initial,
  open,
  onOpenChange,
}: {
  initial: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: vendorDefaults(initial),
  });

  const onSubmit = async (values: VendorFormValues) => {
    setSaving(true);
    const body = {
      ...values,
      email: values.email || undefined,
      contactPerson: values.contactPerson || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
      category: values.category || undefined,
      notes: values.notes || undefined,
      hotelId: activeHotelId || initial?.hotelId || undefined,
    };
    try {
      if (isEdit) {
        await vendorsApi.update(initial.id, body);
        toast.success('Vendor updated');
      } else {
        await vendorsApi.create(body);
        toast.success('Vendor created');
      }
      qc.invalidateQueries({ queryKey: ['vendors'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit vendor' : 'New vendor'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update "${initial.name}"` : 'Add a supplier to the directory'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input placeholder="Bekaa Fresh Produce" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Contact person</Label>
              <Input placeholder="Jane Doe" {...register('contactPerson')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" placeholder="sales@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input placeholder="+1 555 0100" {...register('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input placeholder="City, country" {...register('address')} />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Input placeholder="e.g. Produce" {...register('category')} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea placeholder="Optional notes" {...register('notes')} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select {...register('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create vendor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}