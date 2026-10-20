'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { expensesApi, vendorsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PAGE_SIZE = 20;

const EXPENSE_CATEGORIES = [
  'UTILITIES', 'SALARIES', 'MAINTENANCE', 'SUPPLIES', 'MARKETING',
  'FOOD_BEVERAGE', 'TRANSPORTATION', 'CLEANING', 'OTHER',
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  UTILITIES: 'Utilities',
  SALARIES: 'Salaries',
  MAINTENANCE: 'Maintenance',
  SUPPLIES: 'Supplies',
  MARKETING: 'Marketing',
  FOOD_BEVERAGE: 'Food & Beverage',
  TRANSPORTATION: 'Transportation',
  CLEANING: 'Cleaning',
  OTHER: 'Other',
};

const CATEGORY_VARIANT: Record<string, any> = {
  UTILITIES: 'info',
  SALARIES: 'success',
  MAINTENANCE: 'warning',
  SUPPLIES: 'secondary',
  MARKETING: 'default',
  FOOD_BEVERAGE: 'destructive',
  TRANSPORTATION: 'outline',
  CLEANING: 'secondary',
  OTHER: 'muted',
};

const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'ONLINE_PAYMENT', 'OTHER'] as const;

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  ONLINE_PAYMENT: 'Online Payment',
  OTHER: 'Other',
};

export default function ExpensesPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const summary = useQuery({
    queryKey: ['expenses', 'summary', activeHotelId, fromDate, toDate],
    queryFn: () =>
      expensesApi.summary({
        hotelId: activeHotelId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  });

  const expenses = useQuery({
    queryKey: ['expenses', activeHotelId, categoryFilter, fromDate, toDate, page],
    queryFn: () =>
      expensesApi.list({
        page,
        pageSize: PAGE_SIZE,
        hotelId: activeHotelId || undefined,
        category: categoryFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  });

  const items: any[] = expenses.data?.items || [];
  const totalPages = expenses.data ? Math.max(1, Math.ceil(expenses.data.total / PAGE_SIZE)) : 1;
  const summaryData: any[] = summary.data || [];
  const totalAll = summaryData.reduce((s: number, r: any) => s + r.total, 0);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await expensesApi.remove(deleting.id);
      toast.success('Expense deleted');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete expense');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track and manage hotel expenses</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus /> Record expense
        </Button>
      </div>

      {summary.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : summaryData.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalAll)}</div>
            </CardContent>
          </Card>
          {summaryData.map((r: any) => (
            <Card key={r.category}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {CATEGORY_LABEL[r.category] || r.category}
                </CardTitle>
                <Badge variant={CATEGORY_VARIANT[r.category] || 'outline'} className="text-xs">
                  {r.category.replace(/_/g, ' ')}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(r.total)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Select className="w-44" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>From</Label>
          <Input type="date" className="w-40" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
        </div>
        <div className="grid gap-1.5">
          <Label>To</Label>
          <Input type="date" className="w-40" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {expenses.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No expenses match the current filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="text-sm tabular-nums">{formatDate(exp.date)}</TableCell>
                  <TableCell>
                    <Badge variant={CATEGORY_VARIANT[exp.category] || 'outline'}>
                      {CATEGORY_LABEL[exp.category] || exp.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{exp.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{exp.vendor?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{METHOD_LABEL[exp.paymentMethod] || '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(exp.amount)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(exp); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(exp)}
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
          Showing {items.length} of {expenses.data?.total || 0} expenses
          {(expenses.data as any)?.totalAmount != null && (
            <span className="ml-2">— Total: {formatCurrency((expenses.data as any).totalAmount)}</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm tabular-nums">
            {expenses.data?.page || page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      <ExpenseFormDialog
        initial={editing}
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        hotelId={activeHotelId}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              This will permanently remove the expense record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletingBusy}>
              {deletingBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseFormDialog({
  initial,
  open,
  onOpenChange,
  hotelId,
}: {
  initial: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hotelId: string | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState(initial?.category || '');
  const [amount, setAmount] = useState(initial?.amount?.toString() || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [vendorId, setVendorId] = useState(initial?.vendorId || '');
  const [date, setDate] = useState(initial?.date ? new Date(initial.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod || '');

  const vendors = useQuery({
    queryKey: ['vendors', hotelId],
    queryFn: () => vendorsApi.list({ hotelId: hotelId || undefined }),
    enabled: open,
  });

  const submit = async () => {
    if (!category) {
      toast.error('Category is required');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        category,
        amount: Number(amount),
        description: description.trim(),
        vendorId: vendorId || undefined,
        date: date || undefined,
        paymentMethod: paymentMethod || undefined,
      };
      if (isEdit) {
        await expensesApi.update(initial.id, body);
        toast.success('Expense updated');
      } else {
        body.hotelId = hotelId || undefined;
        await expensesApi.create(body);
        toast.success('Expense recorded');
      }
      qc.invalidateQueries({ queryKey: ['expenses'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expense' : 'Record expense'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update expense details' : 'Add a new expense record'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this expense for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Vendor</Label>
              <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">No vendor</option>
                {(vendors.data?.items || []).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Record expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
