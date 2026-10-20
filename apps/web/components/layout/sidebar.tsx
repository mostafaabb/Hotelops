'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  DoorOpen,
  Sparkles,
  Wrench,
  BedDouble,
  Building2,
  Users,
  Coffee,
  BadgePercent,
  CreditCard,
  FileText,
  Receipt,
  Wallet,
  Package,
  Truck,
  Briefcase,
  BarChart3,
  Settings,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/front-desk', label: 'Front Desk', icon: DoorOpen },
      { href: '/reservations', label: 'Reservations', icon: CalendarDays },
      { href: '/reservations/calendar', label: 'Calendar', icon: MessageSquare },
      { href: '/housekeeping', label: 'Housekeeping', icon: Sparkles },
      { href: '/maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
  {
    label: 'Property',
    items: [
      { href: '/rooms', label: 'Rooms', icon: BedDouble },
      { href: '/room-types', label: 'Room Types', icon: Building },
      { href: '/buildings', label: 'Buildings & Floors', icon: Building2 },
      { href: '/guests', label: 'Guests', icon: Users },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/services', label: 'Services', icon: Coffee },
      { href: '/rate-plans', label: 'Rate Plans', icon: BadgePercent },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/folios', label: 'Folios', icon: Receipt },
      { href: '/expenses', label: 'Expenses', icon: Wallet },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/inventory', label: 'Inventory', icon: Package },
      { href: '/vendors', label: 'Vendors', icon: Truck },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/staff', label: 'Staff & Users', icon: Briefcase },
      { href: '/departments', label: 'Departments', icon: Users },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-background lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          H
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">HotelOps</div>
          <div className="text-[11px] text-muted-foreground">Operations Suite</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-4 text-[11px] text-muted-foreground">
        v1.0.0 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}