'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { getRoleDisplayName } from '@/lib/auth/permissions';
import { cn } from '@lynia/utils';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-[var(--header-height)] items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
              {user?.full_name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) ?? 'A'}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-foreground">
                {user?.full_name ?? 'Admin'}
              </p>
              <p className="text-xs text-muted-foreground">
                {user ? getRoleDisplayName(user.role) : ''}
              </p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
          </button>

          {/* Dropdown menu */}
          <div
            className={cn(
              'absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card py-1 shadow-lg transition-all',
              isProfileOpen
                ? 'visible scale-100 opacity-100'
                : 'invisible scale-95 opacity-0'
            )}
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {user?.full_name}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="py-1">
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent">
                <User className="h-4 w-4" />
                Profile Settings
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
