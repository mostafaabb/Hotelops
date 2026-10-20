'use client';

import Link from 'next/link';
import { DollarSign, Percent, TrendingUp, CalendarCheck, DoorOpen, XCircle, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { reportsApi } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/format';
import { useAuth } from '@/store/auth';

const METHOD_COLORS: Record<string, string> = {
  CASH: 'hsl(var(--primary))',
  CARD: 'hsl(var(--chart-2))',
  BANK_TRANSFER: 'hsl(var(--chart-3))',
  VOUCHER: 'hsl(var(--chart-4))',
  WALLET: 'hsl(var(--chart-5))',
};

function methodLabel(m: string) {
  return m.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);

  const overview = useQuery({
    queryKey: ['reports', 'overview', activeHotelId],
    queryFn: () => reportsApi.overview(activeHotelId ? { hotelId: activeHotelId } : {}),
  });
  const daily = useQuery({
    queryKey: ['reports', 'daily', activeHotelId],
    queryFn: () => reportsApi.daily({ days: 30, ...(activeHotelId ? { hotelId: activeHotelId } : {}) }),
  });
  const topGuests = useQuery({
    queryKey: ['reports', 'topGuests', activeHotelId],
    queryFn: () => reportsApi.topGuests({ limit: 5 }),
  });

  const o = overview.data;
  const chartData = (daily.data?.series || []).map((d: any) => ({
    name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: d.revenue,
    reservations: d.newReservations,
  }));
  const pieData = (o?.revenue?.byMethod || []).map((r: any) => ({
    name: methodLabel(r.method),
    value: r.amount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Operational overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Occupancy', value: o ? formatPercent(o.occupancyRate) : null, icon: Percent, hint: `${o?.rooms || 0} rooms available` },
          { label: 'ADR', value: o ? formatCurrency(o.adr) : null, icon: DollarSign, hint: 'Avg daily rate' },
          { label: 'RevPAR', value: o ? formatCurrency(o.revpar) : null, icon: TrendingUp, hint: 'Revenue per available room' },
          { label: 'Checked in today', value: o ? String(o.checkedOutToday) : null, icon: DoorOpen, hint: 'Check-outs today' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {kpi.value === null ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue chart + revenue by method */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — last 30 days</CardTitle>
            <CardDescription>Completed payments captured per day</CardDescription>
          </CardHeader>
          <CardContent>
            {daily.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={64} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by method</CardTitle>
            <CardDescription>Collected {o ? formatCurrency(o.revenue.collected) : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {o && pieData.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {pieData.map((entry: any, i: number) => (
                        <Cell key={i} fill={METHOD_COLORS[entry.name] || 'hsl(var(--chart-1))'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5">
                  {pieData.map((p: any) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: METHOD_COLORS[p.name] || 'hsl(var(--chart-1))' }} />
                        {p.name}
                      </span>
                      <span className="font-medium">{formatCurrency(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No revenue in range yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reservations + top guests row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Reservation activity</CardTitle>
              <CardDescription>Totals for the current period</CardDescription>
            </div>
            <Link href="/reservations" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Confirmed', value: o?.reservations?.confirmed, icon: CalendarCheck, tone: 'text-primary' },
                { label: 'Checked in', value: o?.reservations?.checkedIn, icon: DoorOpen, tone: 'text-emerald-600' },
                { label: 'Cancelled', value: o?.reservations?.cancelled, icon: XCircle, tone: 'text-destructive' },
                { label: 'No-shows', value: o?.reservations?.noShows, icon: AlertTriangle, tone: 'text-amber-600' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border p-4">
                  <stat.icon className={`mb-2 h-5 w-5 ${stat.tone}`} />
                  <div className="text-2xl font-bold">{stat.value ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Cancellation rate</span>
                <BadgeTone>{o ? `${o.cancellationRate}%` : '—'}</BadgeTone>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Avg length of stay</span>
                <BadgeTone>{o ? `${o.alos} nights` : '—'}</BadgeTone>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Room revenue</span>
                <BadgeTone>{o ? formatCurrency(o.revenue.roomRevenue) : '—'}</BadgeTone>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top guests</CardTitle>
            <CardDescription>By total spend</CardDescription>
          </CardHeader>
          <CardContent>
            {topGuests.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !topGuests.data?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topGuests.data.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Link href={`/guests/${g.id}`} className="font-medium hover:underline">
                          {g.guest?.firstName} {g.guest?.lastName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(g.totalSpent)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BadgeTone({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-border">{children}</span>;
}