'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { updateDistributorProfile } from '@/lib/api/distributor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import {
  User, MapPin, Phone, Mail, Building2, CreditCard,
  Shield, Star, Save, LogOut,
} from 'lucide-react';

export default function ProfilePage() {
  const { distributor, setDistributor, logout } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone_number: distributor?.phone_number ?? '',
    address: distributor?.address ?? '',
    mobile_money_number: distributor?.mobile_money_number ?? '',
    bank_name: distributor?.bank_name ?? '',
    account_number: distributor?.account_number ?? '',
  });

  if (!distributor) return null;

  const handleSave = async () => {
    setSaving(true);
    const updated = await updateDistributorProfile(form);
    setDistributor(updated);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Profile</h1>
          <p className="text-sm text-muted-foreground">Your distributor account details</p>
        </div>
        <Button
          variant={editing ? 'default' : 'outline'}
          size="sm"
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
        >
          {editing ? (
            <><Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving...' : 'Save'}</>
          ) : (
            'Edit Profile'
          )}
        </Button>
      </div>

      {/* Status card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">{distributor.name.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold">{distributor.name}</h2>
            <p className="text-sm text-muted-foreground">{distributor.business_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={distributor.status === 'active' ? 'success' : 'destructive'}>
                {distributor.status}
              </Badge>
              <Badge variant={distributor.kyc_status === 'approved' ? 'success' : 'warning'}>
                KYC {distributor.kyc_status}
              </Badge>
              <div className="flex items-center gap-0.5">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-xs font-medium">{distributor.average_rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4" /> Personal Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Full Name</label>
            <p className="text-sm font-medium">{distributor.name}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">National ID</label>
            <p className="text-sm font-medium">{distributor.national_id}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</label>
            <p className="text-sm font-medium">{distributor.email}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</label>
            {editing ? (
              <input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm font-medium">{distributor.phone_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Business info */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Business Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Business Name</label>
            <p className="text-sm font-medium">{distributor.business_name}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</label>
            <p className="text-sm font-medium">{distributor.city}, {distributor.province}</p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Address</label>
            {editing ? (
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm font-medium">{distributor.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Payment Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Mobile Money (EcoCash)</label>
            {editing ? (
              <input
                value={form.mobile_money_number}
                onChange={(e) => setForm({ ...form, mobile_money_number: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm font-medium">{distributor.mobile_money_number ?? 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Commission Rate</label>
            <p className="text-sm font-medium">{distributor.commission_rate}%</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bank Name</label>
            {editing ? (
              <input
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm font-medium">{distributor.bank_name ?? 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Account Number</label>
            {editing ? (
              <input
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <p className="text-sm font-medium">{distributor.account_number ? `****${distributor.account_number.slice(-4)}` : 'Not set'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" /> Performance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Devices Distributed</p>
            <p className="text-lg font-bold">{distributor.total_devices_distributed}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loans Disbursed</p>
            <p className="text-lg font-bold">{distributor.total_loans_disbursed}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Earned</p>
            <p className="text-lg font-bold text-green-600">${distributor.total_commissions_earned.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Member Since</p>
            <p className="text-lg font-bold">{new Date(distributor.onboarded_at).toLocaleDateString('en-ZW', { month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout}>
        <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
      </Button>
    </div>
  );
}
