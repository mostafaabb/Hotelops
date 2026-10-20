'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Building2, ChevronsUpDown, LogOut, Settings, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { authApi, clearTokens, notificationsApi } from '@/lib/api';
import { initials } from '@/lib/format';

export function Topbar() {
  const router = useRouter();
  const { user, hotels, activeHotelId, setActiveHotelId, clear } = useAuth();
  const activeHotel = hotels.find((h) => h.id === activeHotelId);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
  });

  const notifications = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list({ page: 1, pageSize: 8 }),
    enabled: false,
  });

  const [notifOpen, setNotifOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('hotelops.refresh_token');
      if (refresh) await authApi.logout(refresh);
    } catch {
      /* ignore */
    }
    clearTokens();
    clear();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur">
      <div className="lg:hidden">
        <div className="text-sm font-semibold">HotelOps</div>
      </div>
      <div className="hidden md:block text-sm text-muted-foreground">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="max-w-[180px] truncate">{activeHotel?.name || 'All hotels'}</span>
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Select hotel</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hotels.map((h) => (
              <DropdownMenuItem
                key={h.id}
                onClick={() => {
                  setActiveHotelId(h.id);
                  toast.success(`Switched to ${h.name}`);
                }}
                className={cn('cursor-pointer', h.id === activeHotelId && 'bg-primary/10 text-primary')}
              >
                {h.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread?.count ? (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                  {unread.count}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.data?.items?.length ? (
              <ScrollArea className="h-72">
                {notifications.data.items.map((n: any, i: number) => (
                  <DropdownMenuItem key={i} className="flex flex-col items-start gap-1 py-2">
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body ? <div className="text-xs text-muted-foreground">{n.body}</div> : null}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                <button
                  className="mb-2 w-full rounded-md border p-1 text-xs hover:bg-accent"
                  onClick={() => notifications.refetch()}
                >
                  Load notifications
                </button>
                No notifications yet.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none hover:opacity-90">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {initials(user?.firstName, user?.lastName)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-semibold">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {user?.role?.replace(/_/g, ' ')}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}