'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { amenitiesApi, roomTypesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/store/auth';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  capacity: z.coerce.number().min(1).max(20),
  adultsCapacity: z.coerce.number().min(1).max(20),
  childrenCapacity: z.coerce.number().min(0).max(20),
  basePrice: z.coerce.number().min(0),
  size: z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), z.number().int().optional()),
  bedConfiguration: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  amenityIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

function defaultValues(initial?: any) {
  return initial
    ? {
        name: initial.name,
        code: initial.code,
        description: initial.description || '',
        capacity: initial.capacity,
        adultsCapacity: initial.adultsCapacity,
        childrenCapacity: initial.childrenCapacity,
        basePrice: Number(initial.basePrice),
        size: initial.size ?? undefined,
        bedConfiguration: initial.bedConfiguration || '',
        status: initial.status,
        amenityIds: (initial.amenities || []).map((a: any) => a.id),
      }
    : {
        name: '',
        code: '',
        description: '',
        capacity: 2,
        adultsCapacity: 2,
        childrenCapacity: 1,
        basePrice: 100,
        size: undefined,
        bedConfiguration: '',
        status: 'ACTIVE',
        amenityIds: [],
      };
}

export default function RoomTypesPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const roomTypes = useQuery({
    queryKey: ['room-types', activeHotelId],
    queryFn: () => roomTypesApi.list(activeHotelId ? { hotelId: activeHotelId } : {}),
  });

  const amenities = useQuery({
    queryKey: ['amenities'],
    queryFn: () => amenitiesApi.list(),
  });

  const res: any = roomTypes.data;
  const items: any[] = res?.items || [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (rt: any) => {
    setEditing(rt);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await roomTypesApi.remove(deleting.id);
      toast.success(`Room type "${deleting.name}" deleted`);
      qc.invalidateQueries({ queryKey: ['room-types'] });
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete room type');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room types</h1>
          <p className="text-sm text-muted-foreground">Categories, pricing and amenities</p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> New room type
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {roomTypes.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No room types yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="text-right">Base rate</TableHead>
                <TableHead>Amenities</TableHead>
                <TableHead className="text-right">Rooms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((rt) => (
                <TableRow key={rt.id}>
                  <TableCell>
                    <div className="font-medium">{rt.name}</div>
                    {rt.description && <div className="text-xs text-muted-foreground">{rt.description}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{rt.code}</TableCell>
                  <TableCell>
                    {rt.adultsCapacity} adults · {rt.childrenCapacity} children
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(rt.basePrice))}</TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {(rt.amenities || []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        rt.amenities.slice(0, 4).map((a: any) => (
                          <Badge key={a.id} variant="outline">
                            {a.name}
                          </Badge>
                        ))
                      )}
                      {(rt.amenities || []).length > 4 && (
                        <span className="text-xs text-muted-foreground">+{rt.amenities.length - 4}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      {rt.roomCount ?? 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rt.status === 'ACTIVE' ? 'success' : 'muted'}>{rt.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(rt)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(rt)}>
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
        <RoomTypeForm
          initial={editing}
          amenities={amenities.data || []}
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
            <DialogTitle>Delete room type?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Room types that are used by rooms cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletingBusy}>
              {deletingBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomTypeForm({
  initial,
  amenities,
  open,
  onOpenChange,
}: {
  initial: any;
  amenities: any[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initial),
  });

  const watchAmenities = watch('amenityIds') || [];

  const toggleAmenity = (id: string, checked: boolean) => {
    setValue(
      'amenityIds',
      checked ? [...watchAmenities, id] : watchAmenities.filter((x) => x !== id),
      { shouldDirty: true }
    );
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (isEdit) {
        await roomTypesApi.update(initial.id, values);
        toast.success('Room type updated');
      } else {
        await roomTypesApi.create(values);
        toast.success('Room type created');
      }
      qc.invalidateQueries({ queryKey: ['room-types'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save room type');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit room type' : 'New room type'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update "${initial.name}"` : 'Add a new category of rooms'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input placeholder="Deluxe Suite" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input placeholder="DLX" {...register('code')} />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea placeholder="Optional description" {...register('description')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Capacity</Label>
              <Input type="number" min={1} max={20} {...register('capacity')} />
              {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Adults</Label>
              <Input type="number" min={1} max={20} {...register('adultsCapacity')} />
            </div>
            <div className="grid gap-2">
              <Label>Children</Label>
              <Input type="number" min={0} max={20} {...register('childrenCapacity')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Base price</Label>
              <Input type="number" min={0} step="0.01" {...register('basePrice')} />
              {errors.basePrice && <p className="text-xs text-destructive">{errors.basePrice.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Size (m²)</Label>
              <Input type="number" min={0} placeholder="Optional" {...register('size')} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Bed configuration</Label>
            <Input placeholder="1 King, 1 Twin" {...register('bedConfiguration')} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select {...register('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Amenities</Label>
            {amenities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No amenities available.</p>
            ) : (
              <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2">
                {amenities.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={watchAmenities.includes(a.id)}
                      onCheckedChange={(c) => toggleAmenity(a.id, !!c)}
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create room type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}