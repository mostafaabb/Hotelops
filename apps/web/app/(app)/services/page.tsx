'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { servicesApi, reservationsApi } from '@/lib/api';
import { formatCurrency, formatDateTime, formatMoney } from '@/lib/format';
import { useAuth } from '@/store/auth';

const ORDER_STATUSES = ['ORDERED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const;

const ORDER_STATUS_VARIANT: Record<string, any> = {
  ORDERED: 'info',
  IN_PROGRESS: 'warning',
  DELIVERED: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'muted',
};

function label(str: string | null | undefined) {
  if (!str) return '—';
  return str
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function catalogItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function guestName(guest: any) {
  if (!guest) return '';
  return `${guest.firstName || ''} ${guest.lastName || ''}`.trim();
}

export default function ServicesPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const queryClient = useQueryClient();
  const hotelQuery = activeHotelId ? { hotelId: activeHotelId } : {};

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const catalog = useQuery({
    queryKey: ['services', 'catalog', activeHotelId],
    queryFn: () => servicesApi.catalog(),
    refetchInterval: 30000,
  });

  const orders = useQuery({
    queryKey: ['services', 'orders', activeHotelId],
    queryFn: () => servicesApi.orders({ ...hotelQuery, page: 1, pageSize: 100 }),
    refetchInterval: 30000,
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  const remove = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: () => {
      toast.success('Service removed from catalog');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove service'),
  });

  const cancelOrder = useMutation({
    mutationFn: (id: string) => servicesApi.cancelOrder(id),
    onSuccess: () => {
      toast.success('Order cancelled');
      setCancelTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to cancel order'),
  });

  const items = catalogItems(catalog.data);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground">Catalog of amenities and guest service orders</p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add service
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}><Skeleton className="h-24 w-full" /></TableCell>
                    </TableRow>
                  ) : !items.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No services in the catalog yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.name}</div>
                          {s.description ? (
                            <div className="max-w-[280px] truncate text-xs text-muted-foreground" title={s.description}>
                              {s.description}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{label(s.category)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(s.price))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {s.taxRate ? `${Number(s.taxRate)}%` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.active === false ? 'muted' : 'success'}>
                            {s.active === false ? 'Inactive' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditing(s);
                                setEditorOpen(true);
                              }}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(s)}>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setOrderOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New order
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8}><Skeleton className="h-24 w-full" /></TableCell>
                    </TableRow>
                  ) : !orders.data?.items?.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No service orders yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.data.items.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{guestName(o.reservation?.guest)}</div>
                          <div className="text-xs text-muted-foreground">
                            {o.reservation?.confirmationNumber || ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{o.service?.name}</div>
                          <div className="text-xs text-muted-foreground">{label(o.service?.category)}</div>
                        </TableCell>
                        <TableCell className="text-right">{o.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(o.total)}</TableCell>
                        <TableCell>
                          <Badge variant={ORDER_STATUS_VARIANT[o.status] || 'outline'}>{label(o.status)}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(o.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                            <Button variant="outline" size="sm" onClick={() => setCancelTarget(o)}>
                              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit service' : 'Add service'}</DialogTitle>
            <DialogDescription>Define an item available in the hotel catalog.</DialogDescription>
          </DialogHeader>
          <ServiceForm
            service={editing}
            onSaved={() => {
              setEditorOpen(false);
              setEditing(null);
              invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove service</DialogTitle>
            <DialogDescription>
              Remove “{deleteTarget?.name}” from the catalog? Existing orders are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(deleteTarget.id)}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New service order</DialogTitle>
            <DialogDescription>Charge a service to a guest’s reservation.</DialogDescription>
          </DialogHeader>
          <OrderForm
            onCreated={() => {
              setOrderOpen(false);
              invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>
              Cancel {cancelTarget?.service?.name} for {guestName(cancelTarget?.reservation?.guest)}? The folio is
              adjusted automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Keep order</Button>
            <Button
              variant="destructive"
              disabled={cancelOrder.isPending}
              onClick={() => cancelOrder.mutate(cancelTarget.id)}
            >
              {cancelOrder.isPending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({ service, onSaved }: { service: any; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [category, setCategory] = useState(service?.category || '');
  const [price, setPrice] = useState(service?.price !== undefined ? String(Number(service.price)) : '');
  const [taxRate, setTaxRate] = useState(service?.taxRate !== undefined ? String(Number(service.taxRate)) : '0');
  const [active, setActive] = useState(service?.active !== false);

  const save = useMutation({
    mutationFn: () => {
      const body: any = {
        name,
        ...(description ? { description } : {}),
        ...(category ? { category } : {}),
        price: Number(price || 0),
        taxRate: Number(taxRate || 0),
        active,
      };
      return service
        ? servicesApi.update(service.id, body)
        : servicesApi.create(body);
    },
    onSuccess: () => {
      toast.success(service ? 'Service updated' : 'Service added to catalog');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save service'),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Airport transfer" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Price</Label>
          <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Transportation" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tax rate (%)</Label>
          <Input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" />
      </div>
      {price !== '' && !isNaN(Number(price)) && (
        <div className="text-sm text-muted-foreground">
          Final price includes tax:{' '}
          <span className="font-medium">{formatCurrency(Number(price) * (1 + Number(taxRate || 0) / 100))}</span>
        </div>
      )}
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : service ? 'Save changes' : 'Add service'}
        </Button>
      </DialogFooter>
    </div>
  );
}

function OrderForm({ onCreated }: { onCreated: () => void }) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const queryClient = useQueryClient();

  const catalog = useQuery({
    queryKey: ['services', 'catalog', activeHotelId],
    queryFn: () => servicesApi.catalog(),
  });
  const reservations = useQuery({
    queryKey: ['reservations', 'list', activeHotelId],
    queryFn: () =>
      reservationsApi.list({
        ...(activeHotelId ? { hotelId: activeHotelId } : {}),
        pageSize: 100,
        status: 'CHECKED_IN',
      }),
  });

  const services = catalogItems(catalog.data);
  const res = reservations.data?.items || [];

  const [serviceId, setServiceId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const selectedService = services.find((s: any) => s.id === serviceId);
  const qty = Number(quantity || 0);
  const unit = Number(selectedService?.price || 0);
  const taxRate = Number(selectedService?.taxRate || 0);
  const subtotal = unit * qty;
  const total = Math.round(subtotal * (1 + taxRate / 100) * 100) / 100;

  const create = useMutation({
    mutationFn: () =>
      servicesApi.createOrder({
        serviceId,
        reservationId,
        ...(qty > 1 ? { quantity: qty } : {}),
        ...(notes ? { notes } : {}),
      }),
    onSuccess: () => {
      toast.success('Service order created');
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create order'),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Service</Label>
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Select…</option>
          {services
            .filter((s: any) => s.active !== false)
            .map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatCurrency(Number(s.price))}
              </option>
            ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Reservation / guest</Label>
        <Select value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
          <option value="">Select…</option>
          {res.map((rv: any) => (
            <option key={rv.id} value={rv.id}>
              {rv.confirmationNumber} · {guestName(rv.guest)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">In-house reservations are shown; orders are charged to the folio.</p>
      </div>
      <div className="space-y-2">
        <Label>Quantity</Label>
        <Input
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional instructions" />
      </div>
      {selectedService && qty >= 1 && (
        <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRate}%)</span>
              <span>{formatCurrency(total - subtotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button
          onClick={() => create.mutate()}
          disabled={!serviceId || !reservationId || qty < 1 || create.isPending}
        >
          {create.isPending ? 'Creating…' : 'Create order'}
        </Button>
      </DialogFooter>
    </div>
  );
}