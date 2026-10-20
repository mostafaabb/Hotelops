'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  KeyRound,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { authApi, organizationApi, usersApi } from '@/lib/api';
import { useAuth } from '@/store/auth';

const ORG_ROLES = ['OWNER', 'SUPER_ADMIN'];

export default function SettingsPage() {
  const activeHotelId = useAuth((s) => s.activeHotelId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Organization, profile and security preferences</p>
        </div>
      </div>

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">
            <Building2 className="mr-1.5 h-4 w-4" /> Organization
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserRound className="mr-1.5 h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="mr-1.5 h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>
        <TabsContent value="organization">
          <OrganizationSection activeHotelId={activeHotelId} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrganizationSection({ activeHotelId }: { activeHotelId: string | null }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const canEdit = !!user && ORG_ROLES.includes(user.role);
  const [saving, setSaving] = useState(false);

  const org = useQuery({
    queryKey: ['organizations', 'me', activeHotelId],
    queryFn: () => organizationApi.me(),
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    timezone: '',
    currency: '',
    defaultLanguage: '',
  });

  useEffect(() => {
    if (org.data) {
      setForm({
        name: org.data.name || '',
        email: org.data.email || '',
        phone: org.data.phone || '',
        address: org.data.address || '',
        timezone: org.data.timezone || 'UTC',
        currency: org.data.currency || 'USD',
        defaultLanguage: org.data.defaultLanguage || 'en',
      });
    }
  }, [org.data]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setSaving(true);
    try {
      await organizationApi.update({
        name: form.name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        timezone: form.timezone || undefined,
        currency: form.currency || undefined,
        defaultLanguage: form.defaultLanguage || undefined,
      });
      toast.success('Organization updated');
      qc.invalidateQueries({ queryKey: ['organizations'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const Body = (
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-2">
          <Label>Timezone</Label>
          <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Currency</Label>
          <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-2">
          <Label>Default language</Label>
          <Input value={form.defaultLanguage} onChange={(e) => set('defaultLanguage', e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Address</Label>
        <Input value={form.address} onChange={(e) => set('address', e.target.value)} disabled={!canEdit} />
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving || !canEdit}>
          <Save /> {saving ? 'Saving…' : 'Save organization'}
        </Button>
      </div>
    </CardContent>
  );

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>Company-wide information shown across the platform</CardDescription>
      </CardHeader>
      {!canEdit && (
        <CardContent>
          <Alert variant="warning">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>Only owners and super admins can edit organization details.</AlertDescription>
          </Alert>
        </CardContent>
      )}
      {org.isLoading ? (
        <CardContent>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </CardContent>
      ) : (
        Body
      )}
    </Card>
  );
}

function ProfileSection() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: (user as any).phone || '',
      });
    }
  }, [user]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!user) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      const updated: any = await usersApi.update(user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
      });
      setUser(updated);
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your personal account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>First name</Label>
            <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Last name</Label>
            <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving || !user}>
            <Save /> {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecuritySection() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast.error('New password confirmation does not match');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use a strong, unique password you don't use elsewhere</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Current password</Label>
          <Input
            type="password"
            value={form.currentPassword}
            onChange={(e) => set('currentPassword', e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>New password</Label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={(e) => set('newPassword', e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving}>
            <KeyRound /> {saving ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}