import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const authed = cookieStore.get('hotelops_token');
  if (!authed) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}