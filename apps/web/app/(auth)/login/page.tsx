'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { authApi, clearTokens, hotelsApi, setTokens } from '@/lib/api';
import { useAuth } from '@/store/auth';

const DEMO_PASSWORD = 'Demo123!';
const REMEMBER_KEY = 'hotelops.login.email';

const DEMO_ACCOUNTS = [
  { label: 'Front desk', email: 'frontdesk@hotelops.app' },
  { label: 'Manager', email: 'manager@hotelops.app' },
  { label: 'Owner', email: 'owner@hotelops.app' },
];

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: 'Reservations & front desk',
    desc: 'Check-ins, room moves, folios and payments in one board.',
  },
  {
    icon: Sparkles,
    title: 'Housekeeping & maintenance',
    desc: 'Assign tasks, inspect rooms, track repairs to the minute.',
  },
  {
    icon: BarChart3,
    title: 'Revenue & reporting',
    desc: 'Occupancy, ADR and RevPAR across every property you run.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const setHotels = useAuth((s) => s.setHotels);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res: any = await authApi.login(email, password);
      clearTokens();
      setTokens(res.accessToken, res.refreshToken);
      useAuth.getState().setSession(res.user, res.accessToken);

      if (remember) window.localStorage.setItem(REMEMBER_KEY, email);
      else window.localStorage.removeItem(REMEMBER_KEY);

      const hotels: any[] = await hotelsApi.list(false);
      setHotels(hotels);
      toast.success('Welcome back!');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      const message = err?.message || 'Invalid email or password.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-[1.08fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      <BrandPanel />

      <main className="login-surface relative flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="animate-fade-up w-full max-w-[430px]">
          {/* Compact brand for small screens */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <div>
              <p className="text-[15px] font-semibold tracking-tight">HotelOps</p>
              <p className="text-xs text-muted-foreground">Hotel management &amp; operations</p>
            </div>
          </div>

          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure sign-in
            </span>
            <h1 className="mt-5 text-[30px] font-semibold leading-tight tracking-tight sm:text-[32px]">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sign in to your workspace to pick up where you left off.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.07] px-3.5 py-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="you@hotel.com"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-input/70 bg-muted/40 pl-11 text-sm shadow-none transition focus-visible:border-primary/60 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-input/70 bg-muted/40 pl-11 pr-11 text-sm shadow-none transition focus-visible:border-primary/60 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer h-4 w-4 appearance-none rounded border border-input bg-background transition checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <Check
                    strokeWidth={3}
                    className="pointer-events-none absolute h-3 w-3 scale-75 text-primary-foreground opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100"
                  />
                </span>
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary underline-offset-4 transition hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-500 px-5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:shadow-xl hover:shadow-indigo-600/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="my-7 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use a demo account
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((account) => {
              const active = email === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account.email)}
                  className={
                    'flex h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ' +
                    (active
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/50 hover:text-foreground')
                  }
                >
                  {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  {account.label}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo password{' '}
            <span className="font-mono font-medium text-foreground">{DEMO_PASSWORD}</span>
          </p>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/80">
            The demo API sleeps when idle — the first sign-in can take up to a minute.
          </p>

          <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Systems operational
            </span>
            <span>© {new Date().getFullYear()} HotelOps</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function LogoMark() {
  return (
    <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-sky-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
      <Building2 className="h-5 w-5" />
    </span>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="login-grid absolute inset-0" />
        <div className="animate-aurora absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-indigo-500/30 blur-[140px]" />
        <div className="animate-aurora-slow absolute -right-32 top-1/4 h-[460px] w-[460px] rounded-full bg-sky-400/20 blur-[150px]" />
        <div className="animate-aurora absolute -bottom-48 left-1/4 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-[150px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      <div className="relative flex items-center gap-3">
        <LogoMark />
        <div>
          <p className="text-[15px] font-semibold tracking-tight">HotelOps</p>
          <p className="text-xs text-white/50">Hotel management &amp; operations</p>
        </div>
      </div>

      <div className="relative max-w-lg">
        <h2 className="text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[44px]">
          Every room, guest and{' '}
          <span className="bg-gradient-to-r from-sky-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">
            task in sync.
          </span>
        </h2>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
          Reservations, front desk, housekeeping, maintenance and revenue — one workspace built
          for hotel teams that move fast.
        </p>

        <ul className="mt-9 space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/50">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Tonight at a glance</p>
            <p className="mt-1 flex items-baseline gap-1.5 text-2xl font-semibold">
              87%
              <span className="text-xs font-normal text-white/50">occupied</span>
            </p>
          </div>
          <div className="flex h-14 items-end gap-1.5">
            {[38, 56, 44, 72, 60, 84, 68, 92, 76, 88, 64, 96].map((height, i) => (
              <span
                key={i}
                style={{ height: `${height}%` }}
                className="w-1.5 rounded-full bg-gradient-to-t from-indigo-400/25 to-sky-300/90"
              />
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
          <div>
            <p className="text-white/40">Arrivals</p>
            <p className="mt-0.5 text-sm font-medium">24</p>
          </div>
          <div>
            <p className="text-white/40">Departures</p>
            <p className="mt-0.5 text-sm font-medium">18</p>
          </div>
          <div>
            <p className="text-white/40">Rooms to clean</p>
            <p className="mt-0.5 text-sm font-medium">31</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
