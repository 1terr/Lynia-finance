'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/lib/store/auth-store';
import { updateDistributorProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import { profileSchema, type ProfileFormData } from '@/lib/validation/schemas';
import { useToast } from '@/hooks/use-toast';
import {
  User, MapPin, Phone, Mail, Building2, CreditCard,
  Shield, Star, Save, LogOut,
} from 'lucide-react';

export default function ProfilePage() {
  const { distributor, setDistributor, logout } = useAuthStore();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone_number: distributor?.phone_number ?? '',
      address: distributor?.address ?? '',
      mobile_money_number: distributor?.mobile_money_number ?? '',
      bank_name: distributor?.bank_name ?? '',
      account_number: distributor?.account_number ?? '',
    },
  });

  if (!distributor) return null;

  const onSubmit = async (data: ProfileFormData) => {
    const previousDistributor = distributor;

    // Optimistic update
    setDistributor({ ...distributor!, ...data });
    setEditing(false);

    try {
      const updated = await updateDistributorProfile(data);
      setDistributor(updated);
      toast({ title: 'Profile updated successfully', variant: 'success' });
    } catch {
      // Rollback on failure
      setDistributor(previousDistributor!);
      setEditing(true);
      toast({ title: 'Failed to update profile', description: 'Please try again', variant: 'error' });
    }
    reset(data);
  };

  const handleCancel = () => {
    reset(); // Reset to default values
    setEditing(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Profile</h1>
          <p className="text-sm text-muted-foreground">Your distributor account details</p>
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            variant={editing ? 'default' : 'outline'}
            size="sm"
            onClick={editing ? handleSubmit(onSubmit) : () => setEditing(true)}
            disabled={isSubmitting}
          >
            {editing ? (
              <><Save className="h-4 w-4 mr-1.5" />{isSubmitting ? 'Saving...' : 'Save'}</>
            ) : (
              'Edit Profile'
            )}
          </Button>
        </div>
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
              <Badge variant={distributor.kyc_status === 'approved' || distributor.kyc_status === 'verified' ? 'success' : 'warning'}>
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
              <div className="space-y-1">
                <input
                  {...register('phone_number')}
                  placeholder="+263771234567"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.phone_number && "border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.phone_number && (
                  <p className="text-xs text-red-600">{errors.phone_number.message}</p>
                )}
              </div>
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
              <div className="space-y-1">
                <input
                  {...register('address')}
                  placeholder="123 Main Street, Harare"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.address && "border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.address && (
                  <p className="text-xs text-red-600">{errors.address.message}</p>
                )}
              </div>
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
              <div className="space-y-1">
                <input
                  {...register('mobile_money_number')}
                  placeholder="+263771234567"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.mobile_money_number && "border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.mobile_money_number && (
                  <p className="text-xs text-red-600">{errors.mobile_money_number.message}</p>
                )}
              </div>
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
              <div className="space-y-1">
                <input
                  {...register('bank_name')}
                  placeholder="CBZ Bank"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.bank_name && "border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.bank_name && (
                  <p className="text-xs text-red-600">{errors.bank_name.message}</p>
                )}
              </div>
            ) : (
              <p className="text-sm font-medium">{distributor.bank_name ?? 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Account Number</label>
            {editing ? (
              <div className="space-y-1">
                <input
                  {...register('account_number')}
                  placeholder="1234567890"
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                    errors.account_number && "border-red-500 focus:ring-red-500"
                  )}
                />
                {errors.account_number && (
                  <p className="text-xs text-red-600">{errors.account_number.message}</p>
                )}
              </div>
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
