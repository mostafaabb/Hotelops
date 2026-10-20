'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Search, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { departmentsApi, get } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function DepartmentsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const hotels = useAuth((s) => s.hotels);
  const qc = useQueryClient();

  const [hotelId, setHotelId] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const departments = useQuery({
    queryKey: ['departments', activeHotelId, hotelId],
    queryFn: () =>
      get('/departments', {
        hotelId: hotelId || activeHotelId || undefined,
      }) as Promise<any[]>,
  });

  const items = useMemo(() => {
    const all: any[] = departments.data || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
    );
  }, [departments.data, search]);

  const hotelName = (id?: string | null) => (id ? hotels.find((h) => h.id === id)?.name || '—' : '—');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground">Organize staff into functional teams</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> New department
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-72 pl-8"
              placeholder="Name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Hotel</Label>
          <Select className="w-48" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            <option value="">All hotels</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {departments.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No departments found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead className="text-center">Staff</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="font-medium">{d.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.description || '—'}</TableCell>
                  <TableCell className="text-sm">{hotelName(d.hotelId)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={d.staffCount > 0 ? 'secondary' : 'muted'}>{d.staffCount ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(d);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {formOpen && (
        <DepartmentForm
          initial={editing}
          hotels={hotels}
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface DepartmentFormValues {
  name: string;
  description: string;
  hotelId: string;
}

function DepartmentForm({
  initial,
  hotels,
  open,
  onOpenChange,
}: {
  initial: any;
  hotels: any[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  const form = useForm<DepartmentFormValues>({
    defaultValues: {
      name: initial?.name || '',
      description: initial?.description || '',
      hotelId: initial?.hotelId || '',
    },
  });

  const { register, handleSubmit, reset } = form;

  const onSubmit = async (v: DepartmentFormValues) => {
    if (!v.name.trim()) {
      toast.error('Department name is required');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: v.name.trim(),
        description: v.description || undefined,
        hotelId: v.hotelId || undefined,
      };
      if (isEdit) {
        await departmentsApi.update(initial.id, body);
        toast.success('Department updated');
      } else {
        await departmentsApi.create(body);
        toast.success('Department created');
      }
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === 'departments' || q.queryKey[0] === 'staff',
      });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit department' : 'New department'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update "${initial.name}"` : 'Add a team or function to your organization'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input placeholder="Front Office" {...register('name')} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea placeholder="What does this department do?" {...register('description')} />
          </div>
          <div className="grid gap-2">
            <Label>Hotel</Label>
            <Select {...register('hotelId')}>
              <option value="">All hotels</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create department'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}