'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Eye,
  FileText,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { invoicesApi, foliosApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PAGE_SIZE = 20;

const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID'] as const;

const STATUS_VARIANT: Record<string, any> = {
  DRAFT: 'outline',
  ISSUED: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'destructive',
  VOID: 'muted',
};

export default function InvoicesPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewTarget, setViewTarget] = useState<any>(null);
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [genFromFolio, setGenFromFolio] = useState(false);

  const invoices = useQuery({
    queryKey: ['invoices', activeHotelId, search, statusFilter, page],
    queryFn: () =>
      invoicesApi.list({
        page,
        pageSize: PAGE_SIZE,
        hotelId: activeHotelId || undefined,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const items: any[] = invoices.data?.items || [];
  const totalPages = invoices.data ? Math.max(1, Math.ceil(invoices.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage and track invoices</p>
        </div>
        <Button onClick={() => setGenFromFolio(true)}>
          <Plus /> Generate from folio
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {invoices.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(invoices.data?.totalRevenue || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {invoices.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(invoices.data?.totalOutstanding || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-72 pl-8"
              placeholder="Invoice #, guest, reservation…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select className="w-44" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {invoices.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No invoices match the current filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Reservation</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">
                    {inv.guest ? `${inv.guest.firstName} ${inv.guest.lastName}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{inv.reservation?.confirmationNumber || '—'}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatCurrency(inv.subtotal)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatCurrency(inv.taxTotal)}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(inv.total)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status] || 'outline'}>
                      {inv.status?.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.issuedAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewTarget(inv.id)}>
                          <Eye className="h-4 w-4" /> View
                        </DropdownMenuItem>
                        {inv.status !== 'VOID' && inv.status !== 'PAID' && (
                          <DropdownMenuItem onClick={() => setVoidTarget(inv)}>
                            <XCircle className="h-4 w-4" /> Void
                          </DropdownMenuItem>
                        )}
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
          Showing {items.length} of {invoices.data?.total || 0} invoices
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm tabular-nums">
            {invoices.data?.page || page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      {viewTarget && (
        <InvoiceDetailDialog invoiceId={viewTarget} onOpenChange={(o) => !o && setViewTarget(null)} />
      )}

      <VoidDialog invoice={voidTarget} onOpenChange={(o) => { if (!o) setVoidTarget(null); }} />

      <GenerateFromFolioDialog
        open={genFromFolio}
        onOpenChange={setGenFromFolio}
        hotelId={activeHotelId}
      />
    </div>
  );
}

function InvoiceDetailDialog({
  invoiceId,
  onOpenChange,
}: {
  invoiceId: string;
  onOpenChange: (o: boolean) => void;
}) {
  const invoice = useQuery({
    queryKey: ['invoices', 'detail', invoiceId],
    queryFn: () => invoicesApi.get(invoiceId),
  });

  const inv = invoice.data;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inv?.invoiceNumber || 'Invoice'}</DialogTitle>
          <DialogDescription>
            {inv?.status?.replace(/_/g, ' ')} — {formatDate(inv?.issuedAt)}
          </DialogDescription>
        </DialogHeader>
        {invoice.isLoading || !inv ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Guest</div>
                <div className="font-medium">{inv.guest?.firstName} {inv.guest?.lastName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Reservation</div>
                <div className="font-medium">{inv.reservation?.confirmationNumber || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Hotel</div>
                <div className="font-medium">{inv.hotel?.name || '—'}</div>
              </div>
            </div>

            {inv.items?.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2">Line items</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit price</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inv.items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatCurrency(item.taxAmount)}</TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(inv.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatCurrency(inv.taxTotal)}</span>
                </div>
                {inv.discountTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">-{formatCurrency(inv.discountTotal)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(inv.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="tabular-nums">{formatCurrency(inv.amountPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="tabular-nums font-medium">{formatCurrency(inv.balance)}</span>
                </div>
              </div>
            </div>

            {inv.payments?.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium mb-2">Payments</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inv.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                          <TableCell className="text-sm">{p.method?.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatCurrency(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({
  invoice,
  onOpenChange,
}: {
  invoice: any;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');

  if (!invoice) return null;

  const submit = async () => {
    if (!reason.trim()) {
      toast.error('Void reason is required');
      return;
    }
    setSaving(true);
    try {
      await invoicesApi.void(invoice.id, reason);
      toast.success('Invoice voided');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onOpenChange(false);
      setReason('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to void invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void invoice {invoice.invoiceNumber}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The invoice status will change to VOID.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Reason for voiding</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required reason" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>{saving ? 'Voiding…' : 'Void invoice'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateFromFolioDialog({
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
  const [search, setSearch] = useState('');
  const [selectedFolio, setSelectedFolio] = useState<any>(null);

  const folios = useQuery({
    queryKey: ['invoices', 'folioSearch', hotelId, search],
    queryFn: () =>
      foliosApi.list({
        hotelId: hotelId || undefined,
        search: search || undefined,
        pageSize: 10,
      }),
    enabled: open,
  });

  const submit = async () => {
    if (!selectedFolio) {
      toast.error('Select a folio first');
      return;
    }
    setSaving(true);
    try {
      await invoicesApi.generateFromFolio(selectedFolio.id);
      toast.success('Invoice generated');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onOpenChange(false);
      setSelectedFolio(null);
      setSearch('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate invoice from folio</DialogTitle>
          <DialogDescription>Select a folio to generate an invoice. Rejects if an open invoice already exists.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Folio</Label>
            {selectedFolio ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{selectedFolio.id.slice(0, 8)}…</span>
                  {selectedFolio.guest && (
                    <span className="ml-2 text-muted-foreground">
                      {selectedFolio.guest.firstName} {selectedFolio.guest.lastName}
                    </span>
                  )}
                  {selectedFolio.balance > 0 && (
                    <span className="ml-2 text-destructive font-medium">
                      Balance: {formatCurrency(selectedFolio.balance)}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedFolio(null)}>Clear</Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search folios…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {folios.data?.items?.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {folios.data.items.map((f: any) => (
                      <button
                        key={f.id}
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                        onClick={() => { setSelectedFolio(f); setSearch(''); }}
                      >
                        <div>
                          <span className="font-medium">
                            {f.guest?.firstName} {f.guest?.lastName}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {f.reservation?.confirmationNumber}
                          </span>
                        </div>
                        <span className={f.balance > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {formatCurrency(f.balance)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !selectedFolio}>
            {saving ? 'Generating…' : 'Generate invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
