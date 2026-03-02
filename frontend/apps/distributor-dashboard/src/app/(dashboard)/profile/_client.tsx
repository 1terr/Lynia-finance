'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/lib/store/auth-store';
import { isCognitoConfigured } from '@lynia/auth';
import { updateDistributorProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import { profileSchema, type ProfileFormData } from '@/lib/validation/schemas';
import { useToast } from '@/hooks/use-toast';
import {
  User, MapPin, Phone, Mail, Building2, CreditCard,
  Shield, Star, Save, LogOut, Lock, TrendingUp,
  HelpCircle, ChevronDown, MessageCircle, PhoneCall,
  Calendar, Activity,
} from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'How are my commissions calculated?',
    a: 'You earn a percentage of each loan amount when you complete a device handover. Your rate is shown in your Payment Details section. Commissions are calculated automatically at handover completion.',
  },
  {
    q: 'When do I get paid?',
    a: 'Commissions are paid out monthly via EcoCash or bank transfer to the payment method on your profile. You can check your payout history on the Commissions tab.',
  },
  {
    q: 'What do I do if a customer hasn\u2019t paid their deposit?',
    a: 'The deposit must be paid before you can complete the handover. The customer can pay via EcoCash, cash, or bank transfer. You verify the deposit payment in the handover wizard.',
  },
  {
    q: 'How do I report a faulty device?',
    a: 'Contact the support team via WhatsApp or phone. Provide the IMEI number and describe the issue. Do not hand over devices with known faults.',
  },
  {
    q: 'Can I see customer loan repayment details?',
    a: 'No. Loan repayment data is confidential between Lynia and the customer. You can see your commission status and handover history on your dashboard.',
  },
];

export default function ProfilePage() {
  const { distributor, setDistributor, signOutUser, changePassword } = useAuthStore();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Change password state
  const [changingPassword, setChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
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

  // Activity calculations
  const onboardedDate = new Date(distributor.onboarded_at);
  const now = new Date();
  const monthsActive = Math.max(1,
    (now.getFullYear() - onboardedDate.getFullYear()) * 12 +
    (now.getMonth() - onboardedDate.getMonth())
  );
  const avgPerMonth = monthsActive > 0
    ? (distributor.total_devices_distributed / monthsActive).toFixed(1)
    : '0';

  // Mask payment details for display
  const maskedMomo = distributor.mobile_money_number
    ? distributor.mobile_money_number.replace(/(\+\d{3})\d{4}(\d{3})/, '$1****$2')
    : null;

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setPasswordError('Password must be at least 12 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await changePassword(oldPassword, newPassword);
      if (result.error) {
        setPasswordError(result.error);
      } else {
        toast({ title: 'Password changed successfully', variant: 'success' });
        setChangingPassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch {
      setPasswordError('An unexpected error occurred');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    signOutUser();
    window.location.href = '/login';
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

      {/* Activity summary */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" /> Activity Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Months Active</p>
            <p className="text-lg font-bold">{monthsActive}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg / Month</p>
            <p className="text-lg font-bold">{avgPerMonth}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Handovers</p>
            <p className="text-lg font-bold">{distributor.total_devices_distributed}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rating</p>
            <div className="flex items-center gap-1">
              <p className="text-lg font-bold">{distributor.average_rating.toFixed(1)}</p>
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        </div>
        {/* Tier progress */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">
              Tier progress
            </span>
            <span className="font-medium">
              {distributor.total_devices_distributed} / {distributor.total_devices_distributed < 50 ? 50 : distributor.total_devices_distributed < 100 ? 100 : 200} handovers
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (distributor.total_devices_distributed / (distributor.total_devices_distributed < 50 ? 50 : distributor.total_devices_distributed < 100 ? 100 : 200)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {distributor.total_devices_distributed < 50
              ? 'Bronze tier \u2014 reach 50 handovers for Silver'
              : distributor.total_devices_distributed < 100
                ? 'Silver tier \u2014 reach 100 handovers for Gold'
                : 'Gold tier'}
          </p>
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

      {/* Payment info with clarity */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Payment Details
        </h3>

        {/* Payout destination summary */}
        {maskedMomo && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 px-4 py-3">
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              Commissions paid to: EcoCash {maskedMomo}
            </p>
          </div>
        )}

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
          <TrendingUp className="h-4 w-4" /> Earnings
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Earned</p>
            <p className="text-lg font-bold text-green-600">${distributor.total_commissions_earned.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold">${distributor.total_commissions_paid.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-yellow-600">${distributor.pending_commissions.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Help & Support */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <HelpCircle className="h-4 w-4" /> Help & Support
        </h3>

        {/* FAQ accordion */}
        <div className="space-y-1">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                {item.q}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                    expandedFaq === i && 'rotate-180',
                  )}
                />
              </button>
              {expandedFaq === i && (
                <div className="px-4 pb-3 text-sm text-muted-foreground">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact options */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <a
            href="https://wa.me/263771234567?text=Hi%20Lynia%20Support%2C%20I%20need%20help%20with..."
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <MessageCircle className="h-4 w-4 text-green-600" />
            WhatsApp Support
          </a>
          <a
            href="tel:+263771234567"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <PhoneCall className="h-4 w-4 text-blue-600" />
            Call Support
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Support hours: Mon-Fri 8am-5pm, Sat 8am-1pm (CAT)
        </p>
      </div>

      {/* Change Password */}
      {isCognitoConfigured() && (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4" /> Security
            </h3>
            {!changingPassword && (
              <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                Change Password
              </Button>
            )}
          </div>

          {changingPassword && (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {passwordError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {passwordError}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="At least 12 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={passwordLoading}>
                  {passwordLoading ? 'Changing...' : 'Update Password'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setChangingPassword(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setPasswordError('');
                  }}
                  disabled={passwordLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Logout with confirmation */}
      {showLogoutConfirm ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-5 shadow-sm space-y-3">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Are you sure you want to sign out?
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Yes, Sign Out
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
        </Button>
      )}
    </div>
  );
}
