'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  RefreshCcw,
  Search,
  Undo2,
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
import { paymentsApi, reservationsApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PAGE_SIZE = 20;

const PAYMENT_METHODS = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'ONLINE_PAYMENT', 'OTHER'] as const;

const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'] as const;

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  ONLINE_PAYMENT: 'Online Payment',
  OTHER: 'Other',
};

const STATUS_VARIANT: Record<string, any> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  REFUNDED: 'muted',
  PARTIALLY_REFUNDED: 'info',
};

const METHOD_VARIANT: Record<string, any> = {
  CASH: 'success',
  CREDIT_CARD: 'info',
  DEBIT_CARD: 'info',
  BANK_TRANSFER: 'secondary',
  ONLINE_PAYMENT: 'default',
  OTHER: 'outline',
};

export default function PaymentsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [recordOpen, setRecordOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<any>(null);

  const summary = useQuery({
    queryKey: ['payments', 'summary', activeHotelId],
    queryFn: () => paymentsApi.summary(activeHotelId ? { hotelId: activeHotelId } : {}),
  });

  const payments = useQuery({
    queryKey: ['payments', activeHotelId, search, statusFilter, methodFilter, fromDate, toDate, page],
    queryFn: () =>
      paymentsApi.list({
        page,
        pageSize: PAGE_SIZE,
        hotelId: activeHotelId || undefined,
        search: search || undefined,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
  });

  const items: any[] = payments.data?.items || [];
  const totalPages = payments.data ? Math.max(1, Math.ceil(payments.data.total / PAGE_SIZE)) : 1;
  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">Payment ledger and transaction history</p>
        </div>
        <Button onClick={() => setRecordOpen(true)}>
          <Plus /> Record payment
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total collected', value: s ? formatCurrency(s.total) : null, icon: DollarSign },
          { label: 'Total refunds', value: s ? formatCurrency(s.refunds) : null, icon: Undo2 },
          { label: 'Net revenue', value: s ? formatCurrency(s.total - s.refunds) : null, icon: DollarSign },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {kpi.value === null ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {s?.byMethod?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {s.byMethod.map((m: any) => (
                <div key={m.method} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Badge variant={METHOD_VARIANT[m.method] || 'outline'}>{METHOD_LABEL[m.method] || m.method}</Badge>
                  <span className="font-medium tabular-nums">{formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-72 pl-8"
              placeholder="Guest, reservation, reference…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select className="w-44" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Method</Label>
          <Select className="w-44" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{METHOD_LABEL[m]}</option>
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
        {payments.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No payments match the current filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Reservation</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm tabular-nums">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell className="text-sm">{p.guest ? `${p.guest.firstName} ${p.guest.lastName}` : '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{p.reservation?.confirmationNumber || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={METHOD_VARIANT[p.method] || 'outline'}>
                      {METHOD_LABEL[p.method] || p.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.reference || p.transactionId || '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] || 'outline'}>
                      {p.status?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === 'COMPLETED' && (
                      <Button size="sm" variant="ghost" onClick={() => setRefundTarget(p)}>
                        <Undo2 className="h-4 w-4" /> Refund
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {payments.data?.total || 0} payments
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm tabular-nums">
            {payments.data?.page || page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} hotelId={activeHotelId} />

      <RefundDialog
        payment={refundTarget}
        onOpenChange={(o) => { if (!o) setRefundTarget(null); }}
      />
    </div>
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  hotelId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hotelId: string | null;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const reservationSearch = useQuery({
    queryKey: ['payments', 'reservationSearch', searchTerm],
    queryFn: () =>
      reservationsApi.list({
        search: searchTerm,
        pageSize: 10,
        hotelId: hotelId || undefined,
      }),
    enabled: searchTerm.length >= 2,
  });

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.create({
        amount: Number(amount),
        method,
        reservationId: selectedReservation?.id || undefined,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      toast.success('Payment recorded');
      qc.invalidateQueries({ queryKey: ['payments'] });
      onOpenChange(false);
      setSearchTerm('');
      setSelectedReservation(null);
      setAmount('');
      setMethod('CASH');
      setReference('');
      setNotes('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Log a new payment transaction</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Reservation</Label>
            {selectedReservation ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{selectedReservation.confirmationNumber}</span>
                  {selectedReservation.guest && (
                    <span className="ml-2 text-muted-foreground">
                      {selectedReservation.guest.firstName} {selectedReservation.guest.lastName}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedReservation(null)}>
                  Clear
                </Button>
              </div>
            ) : (
              <Input
                placeholder="Search by name or confirmation number…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}
            {!selectedReservation && (reservationSearch.data as any)?.items?.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {(reservationSearch.data as any).items.map((r: any) => (
                  <button
                    key={r.id}
                    className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                    onClick={() => {
                      setSelectedReservation(r);
                      setSearchTerm('');
                    }}
                  >
                    <span className="font-medium">{r.confirmationNumber}</span>
                    <span className="text-muted-foreground">
                      {r.guest?.firstName} {r.guest?.lastName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label>Method</Label>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, transaction ID, etc." />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({
  payment,
  onOpenChange,
}: {
  payment: any;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  if (!payment) return null;

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Refund amount must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.refund(payment.id, Number(amount), reason || undefined);
      toast.success('Refund processed');
      qc.invalidateQueries({ queryKey: ['payments'] });
      onOpenChange(false);
      setAmount('');
      setReason('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to process refund');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            Original: {formatCurrency(payment.amount)} — {payment.guest?.firstName} {payment.guest?.lastName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Refund amount</Label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for refund" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>{saving ? 'Processing…' : 'Process refund'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
