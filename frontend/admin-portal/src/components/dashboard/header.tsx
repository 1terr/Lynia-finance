'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { getInitials } from '@/lib/utils';
import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function DashboardHeader({ onMenuToggle }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      {/* Left: Menu toggle */}
      <button
        onClick={onMenuToggle}
        className="rounded-md p-2 text-gray-400 hover:text-gray-600 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      {/* Right: Notifications + User menu */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-medium">
              {user ? getInitials(user.first_name, user.last_name) : '?'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-700">
                {user ? `${user.first_name} ${user.last_name}` : 'Loading...'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role.replace('_', ' ')}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2 sm:hidden">
                <p className="text-sm font-medium text-gray-700">
                  {user ? `${user.first_name} ${user.last_name}` : ''}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={() => setDropdownOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
