'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { reservationsApi, availabilityApi } from '@/lib/api';
import { useAuth } from '@/store/auth';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CHECKED_IN: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CHECKED_OUT: 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  INQUIRY: 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300',
  COMPLETED: 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function padDay(d: number) {
  return String(d).padStart(2, '0');
}

export default function ReservationsCalendarPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const daysCount = daysInMonth(year, month);
  const from = `${year}-${padDay(month)}-01`;
  const to = `${year}-${padDay(month)}-${padDay(daysCount)}`;

  const { data: calData, isLoading } = useQuery({
    queryKey: ['reservations', 'calendar', activeHotelId, year, month],
    queryFn: () =>
      reservationsApi.calendar({
        year,
        month,
        ...(activeHotelId ? { hotelId: activeHotelId } : {}),
      }),
  });

  const { data: occData } = useQuery({
    queryKey: ['availability', 'calendar', activeHotelId, from, to],
    queryFn: () =>
      availabilityApi.calendar({
        from,
        to,
        ...(activeHotelId ? { hotelId: activeHotelId } : {}),
      }),
  });

  const rooms: any[] = calData?.rooms || [];
  const reservations: any[] = calData?.reservations || [];

  const monthLabel = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else { setMonth((m) => m - 1); }
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else { setMonth((m) => m + 1); }
  }

  function getReservationForDay(roomId: string, day: number) {
    const dateStr = `${year}-${padDay(month)}-${padDay(day)}`;
    return reservations.find((r: any) => {
      if (r.roomId !== roomId) return false;
      const ci = new Date(r.checkInDate).toISOString().slice(0, 10);
      const co = new Date(r.checkOutDate).toISOString().slice(0, 10);
      return dateStr >= ci && dateStr < co;
    });
  }

  const occupancyByDay = (occData || []).reduce((acc: Record<string, any>, d: any) => {
    acc[d.date] = d;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservations Calendar</h1>
          <p className="text-sm text-muted-foreground">Room occupancy overview by month</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <CardTitle className="text-lg">{monthLabel}</CardTitle>
          <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : rooms.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No rooms found.</div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[800px]">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-background p-2 text-left font-medium text-muted-foreground">Room</th>
                      {Array.from({ length: daysCount }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${padDay(month)}-${padDay(day)}`;
                        const occ = occupancyByDay[dateStr];
                        const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                        return (
                          <th key={day} className={`p-1 text-center font-medium text-muted-foreground ${isToday ? 'text-primary font-bold' : ''}`}>
                            <div>{day}</div>
                            {occ && (
                              <div className="text-[9px] font-normal text-muted-foreground/70">
                                {Math.round(occ.occupancy)}%
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room: any) => (
                      <tr key={room.id} className="border-t border-border/50">
                        <td className="sticky left-0 z-10 bg-background p-2 font-medium whitespace-nowrap">
                          {room.roomNumber}
                          {room.floor && <span className="ml-1 text-[10px] text-muted-foreground">F{room.floor.number}</span>}
                        </td>
                        {Array.from({ length: daysCount }).map((_, i) => {
                          const day = i + 1;
                          const res = getReservationForDay(room.id, day);
                          const dateStr = `${year}-${padDay(month)}-${padDay(day)}`;
                          const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                          return (
                            <td
                              key={day}
                              className={`p-0.5 ${isToday ? 'bg-primary/5' : ''}`}
                            >
                              {res ? (
                                <div
                                  className={`rounded border px-1 py-0.5 text-center text-[10px] leading-tight ${STATUS_COLORS[res.status] || 'bg-gray-100 border-gray-300'}`}
                                  title={`${res.confirmationNumber} - ${res.guestName}`}
                                >
                                  <div className="truncate font-medium">{res.guestName?.split(' ')[0]}</div>
                                </div>
                              ) : (
                                <div className="h-full min-h-[24px]" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Legend:</span>
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded border ${cls}`} />
            {status.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {occData && occData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Daily Occupancy Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {occData.map((d: any) => (
                <div key={d.date} className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  <div className="mt-1 text-lg font-bold">{d.occupancy}%</div>
                  <div className="text-[10px] text-muted-foreground">{d.occupiedRooms}/{d.totalRooms} occupied</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
