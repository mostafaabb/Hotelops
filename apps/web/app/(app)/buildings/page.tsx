'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildingsApi, roomsApi } from '@/lib/api';
import { useAuth } from '@/store/auth';

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

export default function BuildingsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [floorTarget, setFloorTarget] = useState<any>(null);
  const [floorMode, setFloorMode] = useState<'add' | 'rename'>('add');
  const [floorDeleting, setFloorDeleting] = useState<any>(null);
  const [floorDeletingBusy, setFloorDeletingBusy] = useState(false);

  const buildings = useQuery({
    queryKey: ['buildings', activeHotelId],
    queryFn: () => buildingsApi.list(activeHotelId ? { hotelId: activeHotelId } : {}),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buildings & floors</h1>
          <p className="text-sm text-muted-foreground">Physical layout of the property</p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> New building
        </Button>
      </div>

      {buildings.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !buildings.data?.length ? (
        <p className="rounded-lg border bg-background py-10 text-center text-sm text-muted-foreground">
          No buildings yet. Create one to start organizing floors.
        </p>
      ) : (
        <div className="space-y-4">
          {buildings.data.map((b) => (
            <BuildingCard
              key={b.id}
              building={b}
              onEdit={() => openEdit(b)}
              onDelete={() => setDeleting(b)}
              onAddFloor={() => {
                setFloorTarget(b);
                setFloorMode('add');
              }}
              onRenameFloor={(f) => {
                setFloorTarget(f);
                setFloorMode('rename');
              }}
              onDeleteFloor={(f) => setFloorDeleting(f)}
            />
          ))}
        </div>
      )}

      {(formOpen || editing) && (
        <BuildingForm
          initial={editing}
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
          }}
        />
      )}

      {floorTarget && (
        <FloorForm
          building={floorMode === 'add' ? floorTarget : floorTarget.building}
          mode={floorMode}
          floor={floorMode === 'rename' ? floorTarget : undefined}
          open
          onOpenChange={(o) => !o && setFloorTarget(null)}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete building?</DialogTitle>
            <DialogDescription>
              Floors are removed with the building. Rooms keep existing but are unlinked. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingBusy}
              onClick={async () => {
                if (!deleting) return;
                setDeletingBusy(true);
                try {
                  await buildingsApi.remove(deleting.id);
                  toast.success(`Building "${deleting.name}" deleted`);
                  setDeleting(null);
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to delete building');
                } finally {
                  setDeletingBusy(false);
                }
              }}
            >
              {deletingBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!floorDeleting} onOpenChange={(o) => !o && setFloorDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove floor?</DialogTitle>
            <DialogDescription>
              Rooms on this floor keep existing but are unlinked. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFloorDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={floorDeletingBusy}
              onClick={async () => {
                if (!floorDeleting) return;
                setFloorDeletingBusy(true);
                try {
                  await buildingsApi.removeFloor(floorDeleting.id);
                  toast.success('Floor removed');
                  setFloorDeleting(null);
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to remove floor');
                } finally {
                  setFloorDeletingBusy(false);
                }
              }}
            >
              {floorDeletingBusy ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BuildingCard({
  building,
  onEdit,
  onDelete,
  onAddFloor,
  onRenameFloor,
  onDeleteFloor,
}: {
  building: any;
  onEdit: () => void;
  onDelete: () => void;
  onAddFloor: () => void;
  onRenameFloor: (f: any) => void;
  onDeleteFloor: (f: any) => void;
}) {
  const activeHotelId = useAuth((s) => s.activeHotelId);

  const rooms = useQuery({
    queryKey: ['rooms', 'building', building.id, activeHotelId],
    queryFn: () =>
      roomsApi.list({
        pageSize: 200,
        hotelId: activeHotelId || undefined,
        buildingId: building.id,
      }),
  });

  const byFloor = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const room of rooms.data?.items || []) {
      if (!room.floorId) continue;
      (map[room.floorId] = map[room.floorId] || []).push(room);
    }
    return map;
  }, [rooms.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {building.name}
            <span className="font-mono text-xs font-normal text-muted-foreground">{building.code}</span>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {building.totalRooms} rooms · {building.floors?.length || 0} floors
          </p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onAddFloor}>
            <Plus className="h-4 w-4" /> Floor
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        {(building.floors || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No floors yet.</p>
        ) : (
          building.floors.map((f: any) => (
            <div key={f.id} className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Floor {f.number} · {f.name}
                  <span className="ml-2 text-xs text-muted-foreground">{byFloor[f.id]?.length ?? f.roomCount} rooms</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onRenameFloor({ ...f, building })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteFloor(f)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {(byFloor[f.id] || []).length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No rooms assigned to this floor.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {byFloor[f.id].map((room) => (
                    <Badge key={room.id} variant={STATUS_VARIANT[room.status] || 'outline'}>
                      {room.roomNumber}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function BuildingForm({
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
  const [form, setForm] = useState({
    name: initial?.name || '',
    code: initial?.code || '',
    description: initial?.description || '',
  });

  const submit = async () => {
    if (!form.name || !form.code) {
      toast.error('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await buildingsApi.update(initial.id, form);
        toast.success('Building updated');
      } else {
        await buildingsApi.create({ ...form, hotelId: activeHotelId || '' });
        toast.success('Building created');
      }
      qc.invalidateQueries({ queryKey: ['buildings'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save building');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit building' : 'New building'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update "${initial.name}"` : 'Add a building to the property'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Building" />
            </div>
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MB" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create building'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FloorForm({
  building,
  mode,
  floor,
  open,
  onOpenChange,
}: {
  building: any;
  mode: 'add' | 'rename';
  floor?: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: floor?.name || '',
    number: floor?.number ?? 0,
  });

  const submit = async () => {
    if (!form.name) {
      toast.error('Floor name is required');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'rename' && floor) {
        await buildingsApi.updateFloor(floor.id, { name: form.name, number: form.number });
        toast.success('Floor updated');
      } else {
        await buildingsApi.addFloor(building.id, { name: form.name, number: form.number });
        toast.success('Floor added');
      }
      qc.invalidateQueries({ queryKey: ['buildings'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save floor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'rename' ? 'Rename floor' : `Add floor to ${building?.name}`}</DialogTitle>
          <DialogDescription>Floors group rooms within a building.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Number</Label>
            <Input
              type="number"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ground Floor" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : mode === 'rename' ? 'Save changes' : 'Add floor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}