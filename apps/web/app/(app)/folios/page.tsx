'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
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
import { foliosApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PAGE_SIZE = 20;

const ENTRY_TYPE_VARIANT: Record<string, any> = {
  ROOM_CHARGE: 'info',
  SERVICE: 'secondary',
  TAX: 'outline',
  DISCOUNT: 'warning',
  FEE: 'secondary',
  ADJUSTMENT: 'muted',
  REFUND: 'destructive',
};

const ENTRY_TYPES = ['ROOM_CHARGE', 'SERVICE', 'TAX', 'DISCOUNT', 'FEE', 'ADJUSTMENT', 'REFUND'] as const;

export default function FoliosPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const folios = useQuery({
    queryKey: ['folios', activeHotelId, search, page],
    queryFn: () =>
      foliosApi.list({
        page,
        pageSize: PAGE_SIZE,
        hotelId: activeHotelId || undefined,
        search: search || undefined,
      }),
  });

  const items: any[] = folios.data?.items || [];
  const totalPages = folios.data ? Math.max(1, Math.ceil(folios.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Folios</h1>
          <p className="text-sm text-muted-foreground">Guest folios and balance tracking</p>
        </div>
        {folios.data?.totalOutstanding != null && (
          <Card className="py-2 px-4">
            <div className="text-xs text-muted-foreground">Total outstanding</div>
            <div className="text-lg font-bold tabular-nums">{formatCurrency(folios.data.totalOutstanding)}</div>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-72 pl-8"
              placeholder="Guest, confirmation #…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {folios.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No folios found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Reservation</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Refunded</TableHead>
                <TableHead className="text-right">Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer"
                  onClick={() => setDetailId(f.id)}
                >
                  <TableCell className="text-sm font-medium">{f.id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-sm">
                    {f.guest ? `${f.guest.firstName} ${f.guest.lastName}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{f.reservation?.confirmationNumber || '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    <span className={Number(f.balance) > 0 ? 'text-destructive' : ''}>
                      {formatCurrency(f.balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatCurrency(f.paidAmount)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatCurrency(f.refundedAmount || 0)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{f._count?.entries ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {folios.data?.total || 0} folios
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-sm tabular-nums">
            {folios.data?.page || page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      {detailId && (
        <FolioDetailDialog folioId={detailId} onOpenChange={(o) => !o && setDetailId(null)} />
      )}
    </div>
  );
}

function FolioDetailDialog({
  folioId,
  onOpenChange,
}: {
  folioId: string;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryType, setEntryType] = useState('ROOM_CHARGE');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryTax, setEntryTax] = useState('');
  const [saving, setSaving] = useState(false);

  const folio = useQuery({
    queryKey: ['folios', 'detail', folioId],
    queryFn: () => foliosApi.get(folioId),
  });

  const f = folio.data;

  const charges = f?.entries
    ?.filter((e: any) => e.type !== 'REFUND')
    .reduce((sum: number, e: any) => sum + Number(e.amount) + Number(e.taxAmount), 0) || 0;
  const refunds = f?.entries
    ?.filter((e: any) => e.type === 'REFUND')
    .reduce((sum: number, e: any) => sum - Number(e.amount), 0) || 0;
  const paid = f?.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
  const balance = charges - paid - refunds;

  const addEntry = async () => {
    if (!entryDesc.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!entryAmount || Number(entryAmount) <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await foliosApi.addEntry(folioId, {
        type: entryType,
        description: entryDesc.trim(),
        amount: Number(entryAmount),
        taxAmount: entryTax ? Number(entryTax) : undefined,
      });
      toast.success('Entry added');
      qc.invalidateQueries({ queryKey: ['folios'] });
      setAddingEntry(false);
      setEntryDesc('');
      setEntryAmount('');
      setEntryTax('');
      setEntryType('ROOM_CHARGE');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Folio {folioId.slice(0, 8)}…
            {Number(f?.balance) > 0 && (
              <Badge variant="destructive">Balance: {formatCurrency(f?.balance)}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {f?.guest?.firstName} {f?.guest?.lastName} — {f?.reservation?.confirmationNumber}
          </DialogDescription>
        </DialogHeader>

        {folio.isLoading || !f ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-md border p-3">
                <div className="text-lg font-bold tabular-nums">{formatCurrency(charges)}</div>
                <div className="text-xs text-muted-foreground">Charges</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-lg font-bold tabular-nums">{formatCurrency(refunds)}</div>
                <div className="text-xs text-muted-foreground">Refunds</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-lg font-bold tabular-nums">{formatCurrency(paid)}</div>
                <div className="text-xs text-muted-foreground">Paid</div>
              </div>
              <div className="rounded-md border p-3">
                <div className={`text-lg font-bold tabular-nums ${Number(balance) > 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(balance)}
                </div>
                <div className="text-xs text-muted-foreground">Balance</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Entries</div>
              <Button size="sm" variant="outline" onClick={() => setAddingEntry(!addingEntry)}>
                <Plus className="h-4 w-4" /> Add entry
              </Button>
            </div>

            {addingEntry && (
              <div className="rounded-md border p-3 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <Select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                      {ENTRY_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Amount</Label>
                    <Input type="number" min="0.01" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Tax</Label>
                    <Input type="number" min="0" step="0.01" value={entryTax} onChange={(e) => setEntryTax(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Description</Label>
                  <Input value={entryDesc} onChange={(e) => setEntryDesc(e.target.value)} placeholder="Entry description" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAddingEntry(false)}>Cancel</Button>
                  <Button size="sm" onClick={addEntry} disabled={saving}>{saving ? 'Adding…' : 'Add entry'}</Button>
                </div>
              </div>
            )}

            {f.entries?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Badge variant={ENTRY_TYPE_VARIANT[e.type] || 'outline'}>
                          {e.type?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{e.description}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatCurrency(e.amount)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatCurrency(e.taxAmount)}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatCurrency(Number(e.amount) + Number(e.taxAmount))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-args">{formatDate(e.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No entries yet.</p>
            )}

            {f.payments?.length > 0 && (
              <>
                <Separator />
                <div className="text-sm font-medium">Payments</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f.payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                        <TableCell className="text-sm">{p.method?.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
