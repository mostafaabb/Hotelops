'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { reportsApi } from '@/lib/api';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { useAuth } from '@/store/auth';

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const BAR_COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--primary))'];

function legible(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function tooltipStyle() {
  return { borderRadius: 8, border: '1px solid hsl(var(--border))' };
}

export default function ReportsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [days, setDays] = useState('30');
  const [limit, setLimit] = useState('10');

  const base = activeHotelId ? { hotelId: activeHotelId } : {};
  const range = { from, to };
  const apply = { ...base, ...range };

  const overview = useQuery({ queryKey: ['reports', 'overview', activeHotelId, from, to], queryFn: () => reportsApi.overview(apply) });
  const daily = useQuery({ queryKey: ['reports', 'daily', activeHotelId, days], queryFn: () => reportsApi.daily({ ...base, days: Number(days) }) });
  const revenue = useQuery({ queryKey: ['reports', 'revenue', activeHotelId, from, to], queryFn: () => reportsApi.revenue(apply) });
  const sources = useQuery({ queryKey: ['reports', 'sources', activeHotelId, from, to], queryFn: () => reportsApi.sources(apply) });
  const topGuests = useQuery({ queryKey: ['reports', 'topGuests', activeHotelId, limit], queryFn: () => reportsApi.topGuests({ ...base, limit: Number(limit) }) });
  const hk = useQuery({ queryKey: ['reports', 'housekeeping', activeHotelId], queryFn: () => reportsApi.housekeepingEfficiency(base) });

  const o = overview.data;
  const dailySeries = daily.data?.series || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Performance, revenue and operations analytics</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-36" />
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { }}>
            <CalendarRange className="h-4 w-4" /> {formatDate(from)} – {formatDate(to)}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="guests">Top guests</TabsTrigger>
          <TabsTrigger value="housekeeping">Housekeeping</TabsTrigger>
        </TabsList>

        {/* ============ OVERVIEW ============ */}
        <TabsContent value="overview" className="space-y-4">
          {overview.isLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Metric label="Occupancy rate" value={o ? formatPercent(o.occupancyRate) : '—'} sub={`${o?.rooms ?? 0} rooms`} />
                <Metric label="ADR" value={o ? formatCurrency(o.adr) : '—'} sub="Room revenue / occupied nights" />
                <Metric label="RevPAR" value={o ? formatCurrency(o.revpar) : '—'} sub="Room revenue / available nights" />
                <Metric label="Avg length of stay" value={o ? `${o.alos}` : '—'} sub="nights" />
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {o?.hotels && o.hotels.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Hotels</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableBody>
                          {o.hotels.map((h: any) => (
                            <TableRow key={h.id}><TableCell>{h.name}</TableCell><TableCell className="text-right text-muted-foreground">{h.roomCount} rooms</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Reservations</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <StatRow k="Total" v={String(o?.reservations?.total ?? 0)} />
                    <StatRow k="Confirmed" v={String(o?.reservations?.confirmed ?? 0)} />
                    <StatRow k="Checked-in" v={String(o?.reservations?.checkedIn ?? 0)} />
                    <StatRow k="No-shows" v={String(o?.reservations?.noShows ?? 0)} />
                    <StatRow k="Cancelled" v={String(o?.reservations?.cancelled ?? 0)} />
                    <StatRow k="Check-outs" v={String(o?.checkedOutToday ?? 0)} />
                    <StatRow k="Cancellation rate" v={formatPercent(o?.cancellationRate ?? 0)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Revenue · collected</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <StatRow k="Room revenue" v={formatCurrency(o?.revenue?.roomRevenue ?? 0)} />
                      <StatRow k="Collected" v={formatCurrency(o?.revenue?.collected ?? 0)} />
                    </div>
                    {o?.revenue?.byMethod?.length ? (
                      <div className="mt-2 flex h-36 items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={o.revenue.byMethod.map((m: any) => ({ name: legible(m.method), value: m.amount }))} dataKey="value" nameKey="name" innerRadius={30} outerRadius={55} paddingAngle={2}>
                              {o.revenue.byMethod.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle()} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="mt-4 text-xs text-muted-foreground">No payments in range.</p>}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ============ DAILY ============ */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm">Daily activity — last {days} days</CardTitle><CardDescription>Reservations, cancellations and revenue per day</CardDescription></div>
              <div className="w-28"><Input type="number" min={7} max={365} value={days} onChange={(e) => setDays(e.target.value)} /></div>
            </CardHeader>
            <CardContent>
              {daily.isLoading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailySeries.map((d: any) => ({ name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), reservations: d.newReservations, revenue: d.revenue }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} width={54} />
                    <Tooltip formatter={(v: number, n: string) => (n === 'revenue' ? formatCurrency(v) : v)} contentStyle={tooltipStyle()} />
                    <Bar dataKey="reservations" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Per-day breakdown</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">New</TableHead><TableHead className="text-right">Cancelled</TableHead><TableHead className="text-right">Booked value</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dailySeries.length ? dailySeries.slice().reverse().map((d: any, i: number) => (
                      <TableRow key={i}><TableCell>{formatDate(d.date)}</TableCell><TableCell className="text-right">{d.newReservations}</TableCell><TableCell className="text-right text-destructive">{d.cancellations}</TableCell><TableCell className="text-right">{formatCurrency(d.bookedValue)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(d.revenue)}</TableCell></TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No data in range.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Inventory alerts</CardTitle><CardDescription>Products at or below reorder level</CardDescription></CardHeader>
              <CardContent>
                {daily.data?.inventoryAlerts?.length ? (
                  <div className="space-y-2">
                    {daily.data.inventoryAlerts.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="font-medium">{a.name}</span>
                        <Badge variant="destructive">Qty {a.quantity} · reorder {a.reorderLevel}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="py-6 text-center text-sm text-muted-foreground">All products above reorder level.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ REVENUE ============ */}
        <TabsContent value="revenue" className="space-y-4">
          {revenue.isLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="text-sm">By payment method</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1.5 text-sm">{revenue.data?.revenueByMethod.map((m: any) => <StatRow key={m.method} k={legible(m.method)} v={formatCurrency(m.amount)} />)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">By charge type (folio)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1.5 text-sm">{revenue.data?.revenueByChargeType.map((c: any) => <StatRow key={c.type} k={legible(c.type)} v={formatCurrency(c.amount)} />)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Expenses by category</CardTitle></CardHeader>
                <CardContent>
                  {revenue.data?.expensesByCategory?.length ? (
                    <div className="mt-2 h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenue.data.expensesByCategory.map((e: any) => ({ name: legible(e.category), amount: e.amount }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={40} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle()} />
                          <Bar dataKey="amount">{revenue.data.expensesByCategory.map((_: any, i: number) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No expenses in range.</p>}
                  <div className="mt-3 space-y-1.5 text-sm">{revenue.data?.expensesByCategory.map((e: any) => <StatRow key={e.category} k={legible(e.category)} v={formatCurrency(e.amount)} />)}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ============ SOURCES ============ */}
        <TabsContent value="sources" className="space-y-4">
          {sources.isLoading ? <Skeleton className="h-64 w-full" /> : (
            <Card>
              <CardHeader><CardTitle className="text-sm">Booking sources</CardTitle></CardHeader>
              <CardContent>
                {sources.data?.bySource?.length ? (
                  <>
                    <div className="mb-4 h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sources.data.bySource.map((s: any) => ({ name: legible(s.source), revenue: s.revenue }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={54} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle()} />
                          <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Cancellation %</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                      <TableBody>{sources.data.bySource.map((s: any) => (
                        <TableRow key={s.source}><TableCell className="font-medium">{legible(s.source)}</TableCell><TableCell className="text-right">{s.count}</TableCell><TableCell className="text-right">{formatPercent(s.cancellationRate)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(s.revenue)}</TableCell></TableRow>
                      ))}</TableBody>
                    </Table>
                  </>
                ) : <p className="py-6 text-center text-sm text-muted-foreground">No reservations in range.</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ TOP GUESTS ============ */}
        <TabsContent value="guests" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm">Top guests by spend</CardTitle><CardDescription>Ranked by completed payments</CardDescription></div>
              <div className="w-24"><Input type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead className="text-right">Stays</TableHead><TableHead className="text-right">Total spend</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {topGuests.data?.items?.length ? topGuests.data.items.map((g: any) => (
                    <TableRow key={g.id}><TableCell><div className="font-medium">{g.firstName} {g.lastName}</div><div className="text-xs text-muted-foreground">{g.email || g.phone || '—'}</div></TableCell><TableCell className="text-right">{g.totalStays}</TableCell><TableCell className="text-right font-medium">{formatCurrency(g.totalSpend)}</TableCell><TableCell className="text-right">{g.isVip ? <Badge>VIP</Badge> : <Badge variant="outline">Standard</Badge>}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No guest data yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ HOUSEKEEPING ============ */}
        <TabsContent value="housekeeping" className="space-y-4">
          {hk.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Metric label="Completed tasks" value={String(hk.data?.total ?? 0)} sub="in period" />
              <Metric label="Avg. cleaning time" value={`${hk.data?.avgMinutes ?? 0} min`} sub="per task" />
              <Metric label="Pending" value={String(hk.data?.pending ?? 0)} sub="completed only" />
              <Metric label="Efficiency score" value={formatPercent(hk.data?.efficiencyScore ?? 0)} sub="relative metric" />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground">{sub}</p></CardContent>
    </Card>
  );
}

function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}