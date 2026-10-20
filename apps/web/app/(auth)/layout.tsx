import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const authed = cookieStore.get('hotelops_token');
  if (authed) {
    redirect('/');
  }
  return <>{children}</>;
}