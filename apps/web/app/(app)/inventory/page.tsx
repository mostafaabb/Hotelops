'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { hotelsApi, inventoryApi, vendorsApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';

const MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'] as const;

const MOVEMENT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'info'> = {
  IN: 'success',
  OUT: 'destructive',
  TRANSFER: 'warning',
  ADJUSTMENT: 'info',
};

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().optional(),
  unit: z.string().optional(),
  cost: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  quantity: z.coerce.number().int().min(0),
  minimumStock: z.coerce.number().int().min(0),
  supplier: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const movementSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().int().min(0),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

type MovementFormValues = z.infer<typeof movementSchema>;

function productDefaults(initial?: any): ProductFormValues {
  return initial
    ? {
        name: initial.name || '',
        sku: initial.sku || '',
        category: initial.category || '',
        unit: initial.unit || 'pcs',
        cost: initial.cost !== null && initial.cost !== undefined ? Number(initial.cost) : undefined,
        quantity: initial.quantity ?? 0,
        minimumStock: initial.minimumStock ?? 5,
        supplier: initial.supplier || '',
      }
    : {
        name: '',
        sku: '',
        category: '',
        unit: 'pcs',
        cost: undefined,
        quantity: 0,
        minimumStock: 5,
        supplier: '',
      };
}

function movementLabel(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function asArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return data?.items || [];
}

export default function InventoryPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [hotelFilter, setHotelFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [productForm, setProductForm] = useState<{ open: boolean; editing?: any }>({ open: false });
  const [movementForm, setMovementForm] = useState<{ open: boolean; product?: any; type?: string }>({ open: false });
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const products = useQuery({
    queryKey: ['inventory', 'products', activeHotelId],
    queryFn: () => inventoryApi.products({ pageSize: 200, ...(activeHotelId ? { hotelId: activeHotelId } : {}) }),
  });

  const movements = useQuery({
    queryKey: ['inventory', 'movements', activeHotelId],
    queryFn: () => inventoryApi.movements({ pageSize: 200, ...(activeHotelId ? { hotelId: activeHotelId } : {}) }),
  });

  const vendors = useQuery({
    queryKey: ['vendors', activeHotelId],
    queryFn: () => vendorsApi.list({ pageSize: 200, ...(activeHotelId ? { hotelId: activeHotelId } : {}) }),
  });

  const hotels = useQuery({
    queryKey: ['hotels', 'inventory', activeHotelId],
    queryFn: () => hotelsApi.list(false),
  });

  const allProducts: any[] = asArray(products.data);
  const allMovements: any[] = asArray(movements.data);
  const hotelOptions: any[] = hotels.data || [];

  const categories = useMemo(
    () =>
      Array.from(new Set(allProducts.map((p: any) => p.category).filter(Boolean))).sort() as string[],
    [allProducts]
  );

  const scope = useMemo(
    () => allProducts.filter((p: any) => !hotelFilter || p.hotelId === hotelFilter),
    [allProducts, hotelFilter]
  );

  const filteredProducts = useMemo(
    () =>
      scope.filter((p: any) => {
        if (categoryFilter && p.category !== categoryFilter) return false;
        if (lowStockOnly && !(p.isLowStock ?? p.quantity <= p.minimumStock)) return false;
        if (searchText && !`${p.name} ${p.sku}`.toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
      }),
    [scope, categoryFilter, lowStockOnly, searchText]
  );

  const filteredMovements = useMemo(
    () => allMovements.filter((m: any) => !hotelFilter || m.hotelId === hotelFilter),
    [allMovements, hotelFilter]
  );

  const totalProducts = scope.length;
  const totalValue = scope.reduce((sum, p: any) => sum + (p.quantity ?? 0) * (Number(p.cost) || 0), 0);
  const lowStockCount = scope.filter((p: any) => p.isLowStock ?? p.quantity <= p.minimumStock).length;
  const vendorCount = asArray(vendors.data).length;

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await inventoryApi.removeProduct(deleting.id);
      toast.success(`Product "${deleting.name}" deleted`);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete product');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Products, stock levels and movements</p>
        </div>
        <Button onClick={() => setProductForm({ open: true })}>
          <Plus /> New product
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total products</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {products.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{totalProducts}</div>
            )}
            <p className="text-xs text-muted-foreground">Across the organization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {products.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            )}
            <p className="text-xs text-muted-foreground">Quantity × unit cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {products.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{lowStockCount}</div>
            )}
            <p className="text-xs text-muted-foreground">At or below minimum</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendors</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {vendors.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{vendorCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Registered suppliers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name or SKU…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <Select value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)} className="w-44">
              <option value="">All hotels</option>
              {hotelOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-40">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={lowStockOnly} onCheckedChange={(c) => setLowStockOnly(!!c)} />
              Low stock only
            </label>
          </div>

          <div className="rounded-lg border bg-card">
            {products.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No products match your filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => {
                    const low = p.isLowStock ?? p.quantity <= p.minimumStock;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                        </TableCell>
                        <TableCell>
                          {p.category ? <Badge variant="outline">{p.category}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.supplier || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.unit || 'pcs'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 tabular-nums">
                            {p.quantity}
                            {low && <Badge variant="destructive">Low</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(p.cost) || 0)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency((p.quantity ?? 0) * (Number(p.cost) || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Stock in"
                              onClick={() => setMovementForm({ open: true, product: p, type: 'IN' })}
                            >
                              <PackagePlus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Issue stock"
                              onClick={() => setMovementForm({ open: true, product: p, type: 'OUT' })}
                            >
                              <PackageMinus className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setProductForm({ open: true, editing: p })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Stock in / out history</p>
            <Button onClick={() => setMovementForm({ open: true })}>
              <Plus /> Record movement
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            {movements.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredMovements.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No movements recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{m.product?.name || m.productId}</div>
                        {m.product?.sku && <div className="font-mono text-xs text-muted-foreground">{m.product.sku}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={MOVEMENT_VARIANT[m.type] || 'outline'}>{movementLabel(m.type)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        <MovementQty type={m.type} quantity={m.quantity} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.reason || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.reference || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.performedBy ? (
                          <span title={m.performedBy} className="font-mono text-xs">
                            {m.performedBy.slice(0, 8)}…
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {(productForm.open || productForm.editing) && (
        <ProductForm
          initial={productForm.editing}
          vendors={asArray(vendors.data)}
          categories={categories}
          open={productForm.open}
          onOpenChange={(o) => {
            setProductForm({ open: o, editing: o ? productForm.editing : undefined });
            if (!o) setProductForm({ open: false });
          }}
        />
      )}

      {movementForm.open && (
        <MovementForm
          products={scope}
          initialProduct={movementForm.product}
          initialType={movementForm.type}
          open={movementForm.open}
          onOpenChange={(o) => setMovementForm({ open: o })}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>
              "{deleting?.name}" will be permanently removed along with its movement history. This cannot be undone.
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

function MovementQty({ type, quantity }: { type: string; quantity: number }) {
  const color =
    type === 'IN'
      ? 'text-emerald-600 dark:text-emerald-400'
      : type === 'OUT'
        ? 'text-destructive'
        : type === 'TRANSFER'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-foreground';
  const sign = type === 'IN' ? '+' : type === 'ADJUSTMENT' ? '→' : '−';
  return <span className={color}>{sign}{quantity}</span>;
}

function ProductForm({
  initial,
  vendors,
  categories,
  open,
  onOpenChange,
}: {
  initial?: any;
  vendors: any[];
  categories: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: productDefaults(initial),
  });

  const categoryOptions = useMemo(() => {
    const set = new Set(categories);
    if (initial?.category) set.add(initial.category);
    return Array.from(set);
  }, [categories, initial]);

  const supplierOptions = useMemo(() => {
    const set = new Set(vendors.map((v) => v.name).filter(Boolean));
    if (initial?.supplier) set.add(initial.supplier);
    return Array.from(set) as string[];
  }, [vendors, initial]);

  const onSubmit = async (values: ProductFormValues) => {
    setSaving(true);
    const body = {
      ...values,
      supplier: values.supplier || undefined,
      category: values.category || undefined,
      cost: values.cost ?? undefined,
      hotelId: activeHotelId || initial?.hotelId || undefined,
    };
    try {
      if (isEdit) {
        await inventoryApi.updateProduct(initial.id, body);
        toast.success('Product updated');
      } else {
        await inventoryApi.createProduct(body);
        toast.success('Product created');
      }
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update "${initial.name}"` : 'Add an item to inventory'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input placeholder="Toilet Paper Roll" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>SKU</Label>
              <Input placeholder="TP-001" {...register('sku')} />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              {categoryOptions.length > 0 ? (
                <Select {...register('category')}>
                  <option value="">No category</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input placeholder="e.g. Cleaning" {...register('category')} />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Input placeholder="pcs" {...register('unit')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Unit cost</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" {...register('cost')} />
              {errors.cost && <p className="text-xs text-destructive">{errors.cost.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Supplier</Label>
              {supplierOptions.length > 0 ? (
                <Select {...register('supplier')}>
                  <option value="">No supplier</option>
                  {supplierOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input placeholder="Supplier name" {...register('supplier')} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input type="number" min={0} {...register('quantity')} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Minimum stock</Label>
              <Input type="number" min={0} {...register('minimumStock')} />
              {errors.minimumStock && <p className="text-xs text-destructive">{errors.minimumStock.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementForm({
  products,
  initialProduct,
  initialType,
  open,
  onOpenChange,
}: {
  products: any[];
  initialProduct?: any;
  initialType?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      productId: initialProduct?.id || '',
      type: (initialType || 'IN') as MovementFormValues['type'],
      quantity: 0,
      reason: '',
      reference: '',
    },
  });

  const onSubmit = async (values: MovementFormValues) => {
    setSaving(true);
    try {
      await inventoryApi.createMovement({
        productId: values.productId,
        type: values.type,
        quantity: values.quantity,
        reason: values.reason || undefined,
        reference: values.reference || undefined,
      });
      toast.success('Movement recorded');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record movement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record movement</DialogTitle>
          <DialogDescription>Adjust stock with a movement entry</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label>Product</Label>
            <Select {...register('productId')}>
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) · {p.quantity} {p.unit || 'pcs'}
                </option>
              ))}
            </Select>
            {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select {...register('type')}>
                <option value="IN">IN — stock received</option>
                <option value="OUT">OUT — stock issued</option>
                <option value="TRANSFER">TRANSFER — moved out</option>
                <option value="ADJUSTMENT">ADJUSTMENT — set quantity</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input type="number" min={0} {...register('quantity')} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Note</Label>
            <Textarea placeholder="Optional note" {...register('reason')} />
          </div>
          <div className="grid gap-2">
            <Label>Reference</Label>
            <Input placeholder="e.g. PO-1234" {...register('reference')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Record movement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}