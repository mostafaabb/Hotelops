'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { roomTypesApi, ratePlansApi, get } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuth } from '@/store/auth';

type Payload = Record<string, unknown>;

export default function RatePlansPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rate-plans'] });
  };

  const plans = useQuery({ queryKey: ['rate-plans', 'plans', activeHotelId], queryFn: () => listAll((p: number) => get('/rate-plans', { page: p, hotelId: activeHotelId || undefined })) });
  const taxes = useQuery({ queryKey: ['rate-plans', 'taxes', activeHotelId], queryFn: () => listAll((p: number) => get('/rate-plans/taxes/list', { page: p, hotelId: activeHotelId || undefined })) });
  const promos = useQuery({ queryKey: ['rate-plans', 'promos', activeHotelId], queryFn: () => listAll((p: number) => get('/rate-plans/promo-codes/list', { page: p, hotelId: activeHotelId || undefined })) });
  const seasonal = useQuery({ queryKey: ['rate-plans', 'seasonal', activeHotelId], queryFn: () => listAll((p: number) => get('/rate-plans/seasonal/list', { page: p, hotelId: activeHotelId || undefined })) });
  const roomTypes = useQuery({ queryKey: ['room-types'], queryFn: () => roomTypesApi.list() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rate plans &amp; pricing</h1>
        <p className="text-sm text-muted-foreground">Base rates, taxes, promo codes and seasonality</p>
      </div>
      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="plans">Rate plans</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="promos">Promo codes</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <RatePlanDialog roomTypes={(roomTypes.data || []) as any[]} onSaved={() => { plans.refetch(); invalidate(); }} />
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Room type</TableHead><TableHead className="text-right">Base price</TableHead><TableHead className="text-right">Min stay</TableHead><TableHead>Refundable</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {plans.isLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                    plans.data?.length ? plans.data.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell><div className="font-medium">{p.name}</div>{p.description ? <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div> : null}</TableCell>
                        <TableCell className="text-muted-foreground">{p.roomType?.name || 'Any'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.basePrice)}</TableCell>
                        <TableCell className="text-right">{p.minimumStay}</TableCell>
                        <TableCell>{p.isRefundable ? <Badge variant="outline">Refundable</Badge> : <Badge variant="secondary">Non-refundable</Badge>}</TableCell>
                        <TableCell>{p.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No rate plans yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-4">
          <div className="flex justify-end">
            <TaxDialog onSaved={() => { taxes.refetch(); invalidate(); }} />
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Rate</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {taxes.isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                    taxes.data?.length ? taxes.data.map((t: any) => (
                      <TableRow key={t.id}><TableCell className="font-medium">{t.name}</TableCell><TableCell className="text-right">{t.rate}%</TableCell><TableCell className="text-muted-foreground">{t.type}</TableCell><TableCell>{t.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell></TableRow>
                    )) : <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No tax rates yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promos" className="space-y-4">
          <div className="flex justify-end">
            <PromoDialog onSaved={() => { promos.refetch(); invalidate(); }} />
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead className="text-right">Min amount</TableHead><TableHead>Valid window</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {promos.isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                    promos.data?.length ? promos.data.map((c: any) => (
                      <TableRow key={c.id}><TableCell className="font-mono font-medium">{c.code}</TableCell><TableCell>{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : formatCurrency(c.discountValue)}</TableCell><TableCell className="text-right">{formatCurrency(c.minAmount)}</TableCell><TableCell className="text-xs text-muted-foreground">{c.validFrom ? formatDate(c.validFrom) : '—'} → {c.validTo ? formatDate(c.validTo) : '—'}</TableCell><TableCell>{c.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell></TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No promo codes yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <div className="flex justify-end">
            <SeasonalDialog roomTypes={(roomTypes.data || []) as any[]} plans={(plans.data || []) as any[]} onSaved={() => { seasonal.refetch(); invalidate(); }} />
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Period</TableHead><TableHead>Adjustment</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                <TableBody>
                  {seasonal.isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                    seasonal.data?.length ? seasonal.data.map((s: any) => (
                      <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(s.startDate)} → {formatDate(s.endDate)}</TableCell><TableCell>{s.adjustmentType === 'PERCENTAGE' ? `${s.adjustment}%` : formatCurrency(s.adjustment)}</TableCell><TableCell><Badge variant="outline">{s.adjustmentType}</Badge></TableCell></TableRow>
                    )) : <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No seasonal pricing yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function listAll(fn: (page: number) => Promise<any>): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  let total = 1;
  while (all.length < total && page <= 20) {
    const res: any = await fn(page);
    const items = res?.items ?? [];
    total = res?.total ?? items.length;
    all.push(...items);
    if (items.length === 0) break;
    page += 1;
  }
  return all;
}

// ---------- RATE PLAN DIALOG ----------
function RatePlanDialog({ roomTypes, onSaved }: { roomTypes: any[]; onSaved: () => void }) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<Record<string, any>>({ name: '', basePrice: '', cancellationPolicy: 'Free cancellation 48 hours before arrival', minimumStay: '1', isRefundable: true, active: true });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!body.name || !body.basePrice) return toast.error('Name and base price are required');
    setSaving(true);
    try {
      await ratePlansApi.create({
        name: body.name,
        description: body.description || undefined,
        basePrice: Number(body.basePrice),
        cancellationPolicy: body.cancellationPolicy,
        minimumStay: body.minimumStay ? Number(body.minimumStay) : 1,
        isRefundable: Boolean(body.isRefundable),
        active: Boolean(body.active),
        roomTypeId: body.roomTypeId || undefined,
        hotelId: activeHotelId || undefined,
      });
      toast.success('Rate plan created');
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New rate plan</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New rate plan</DialogTitle><DialogDescription>Define a base rate for a room type or all rooms.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><Input value={body.name} onChange={(e) => setBody({ ...body, name: e.target.value })} placeholder="e.g. Deluxe Standard" /></Field>
          <Field label="Description"><Input value={body.description || ''} onChange={(e) => setBody({ ...body, description: e.target.value })} placeholder="Optional" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base price (per night)"><Input type="number" min={0} step="0.01" value={body.basePrice} onChange={(e) => setBody({ ...body, basePrice: e.target.value })} /></Field>
            <Field label="Room type"><Select value={body.roomTypeId || ''} onChange={(e) => setBody({ ...body, roomTypeId: e.target.value })}><option value="">Any room</option>{roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
          </div>
          <Field label="Cancellation policy"><Textarea value={body.cancellationPolicy} onChange={(e) => setBody({ ...body, cancellationPolicy: e.target.value })} rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum stay"><Input type="number" min={1} value={body.minimumStay} onChange={(e) => setBody({ ...body, minimumStay: e.target.value })} /></Field>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={body.isRefundable} onChange={(e) => setBody({ ...body, isRefundable: e.target.checked })} /> Refundable</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={body.active} onChange={(e) => setBody({ ...body, active: e.target.checked })} /> Active</label>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- TAX DIALOG ----------
function TaxDialog({ onSaved }: { onSaved: () => void }) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name || !rate) return toast.error('Name and rate are required');
    setSaving(true);
    try {
      await ratePlansApi.taxes.create({ name, rate: Number(rate), type: 'PERCENTAGE', hotelId: activeHotelId || undefined });
      toast.success('Tax rate created');
      setOpen(false); setName(''); setRate('');
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New tax</Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>New tax rate</DialogTitle><DialogDescription>Percentage-based tax applied to reservations.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VAT" /></Field>
          <Field label="Rate (%)"><Input type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- PROMO DIALOG ----------
function PromoDialog({ onSaved }: { onSaved: () => void }) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<Record<string, any>>({ code: '', discountType: 'PERCENTAGE', discountValue: '', minAmount: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!body.code || !body.discountValue) return toast.error('Code and discount value are required');
    setSaving(true);
    try {
      await ratePlansApi.promoCodes.create({
        code: body.code.toUpperCase(),
        discountType: body.discountType,
        discountValue: Number(body.discountValue),
        minAmount: body.minAmount ? Number(body.minAmount) : undefined,
        validFrom: body.validFrom || undefined,
        validTo: body.validTo || undefined,
        active: true,
        hotelId: activeHotelId || undefined,
      });
      toast.success('Promo code created');
      setOpen(false); setBody({ code: '', discountType: 'PERCENTAGE', discountValue: '', minAmount: '' });
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New promo</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New promo code</DialogTitle><DialogDescription>Offer a percentage or fixed-amount discount.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><Input value={body.code} onChange={(e) => setBody({ ...body, code: e.target.value })} placeholder="SUMMER20" className="font-mono" /></Field>
            <Field label="Discount type"><Select value={body.discountType} onChange={(e) => setBody({ ...body, discountType: e.target.value })}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value"><Input type="number" min={0} step="0.01" value={body.discountValue} onChange={(e) => setBody({ ...body, discountValue: e.target.value })} /></Field>
            <Field label="Min booking amount"><Input type="number" min={0} step="0.01" value={body.minAmount} onChange={(e) => setBody({ ...body, minAmount: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid from"><Input type="date" value={body.validFrom || ''} onChange={(e) => setBody({ ...body, validFrom: e.target.value })} /></Field>
            <Field label="Valid to"><Input type="date" value={body.validTo || ''} onChange={(e) => setBody({ ...body, validTo: e.target.value })} /></Field>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- SEASONAL DIALOG ----------
function SeasonalDialog({ roomTypes, plans, onSaved }: { roomTypes: any[]; plans: any[]; onSaved: () => void }) {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<Record<string, any>>({ name: '', adjustmentType: 'PERCENTAGE', adjustment: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!body.name || !body.adjustment || !body.startDate || !body.endDate) return toast.error('All required fields must be filled');
    setSaving(true);
    try {
      await ratePlansApi.seasonal.create({
        name: body.name, adjustmentType: body.adjustmentType, adjustment: Number(body.adjustment),
        startDate: body.startDate, endDate: body.endDate,
        roomTypeId: body.roomTypeId || undefined, ratePlanId: body.ratePlanId || undefined, hotelId: activeHotelId || undefined,
      });
      toast.success('Seasonal pricing created');
      setOpen(false); setBody({ name: '', adjustmentType: 'PERCENTAGE', adjustment: '', startDate: '', endDate: '' });
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New seasonal pricing</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Seasonal pricing</DialogTitle><DialogDescription>Adjust rates for a date range (optionally per room type or plan).</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><Input value={body.name} onChange={(e) => setBody({ ...body, name: e.target.value })} placeholder="e.g. Summer Peak" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="date" value={body.startDate} onChange={(e) => setBody({ ...body, startDate: e.target.value })} /></Field>
            <Field label="End"><Input type="date" value={body.endDate} onChange={(e) => setBody({ ...body, endDate: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adjustment"><Input type="number" step="0.01" value={body.adjustment} onChange={(e) => setBody({ ...body, adjustment: e.target.value })} /></Field>
            <Field label="Type"><Select value={body.adjustmentType} onChange={(e) => setBody({ ...body, adjustmentType: e.target.value })}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room type"><Select value={body.roomTypeId || ''} onChange={(e) => setBody({ ...body, roomTypeId: e.target.value })}><option value="">Any room</option>{roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
            <Field label="Rate plan"><Select value={body.ratePlanId || ''} onChange={(e) => setBody({ ...body, ratePlanId: e.target.value })}><option value="">Any plan</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}