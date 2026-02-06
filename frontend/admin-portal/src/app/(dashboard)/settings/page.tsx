'use client';

import { useState } from 'react';
import type { SettingsTab } from '@/types/settings';
import { UserManagement } from '@/components/settings/user-management';
import { RolesPermissions } from '@/components/settings/roles-permissions';
import { NotificationTemplates } from '@/components/settings/notification-templates';
import { SystemConfiguration } from '@/components/settings/system-config';
import { AuditLog } from '@/components/settings/audit-log';
import { cn } from '@/lib/utils';
import { Users, Shield, Bell, Settings, ScrollText } from 'lucide-react';

const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'system', label: 'System Config', icon: Settings },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings & Configuration</h1>
        <p className="text-muted-foreground mt-1">Manage users, roles, notifications, and system settings</p>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 border-b">
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'roles' && <RolesPermissions />}
        {activeTab === 'notifications' && <NotificationTemplates />}
        {activeTab === 'system' && <SystemConfiguration />}
        {activeTab === 'audit' && <AuditLog />}
      </div>
    </div>
  );
}
