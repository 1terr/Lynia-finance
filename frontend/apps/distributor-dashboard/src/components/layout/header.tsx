'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { useTheme } from 'next-themes';
import { Bell, Menu, Sun, Moon, WifiOff, Check } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

// Static notifications for now — wired to backend GET /notifications later
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Commission Paid',
    message: 'Your February commission of $62.50 has been paid to EcoCash.',
    time: '2 hours ago',
    read: false,
  },
  {
    id: '2',
    title: 'New Inventory',
    message: '5 new Tecno Spark 20 devices added to your inventory.',
    time: '1 day ago',
    read: false,
  },
  {
    id: '3',
    title: 'Rating Updated',
    message: 'Your distributor rating improved to 4.7 stars.',
    time: '3 days ago',
    read: true,
  },
];

export function Header() {
  const { distributor } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
        <div className="flex items-center gap-3 md:hidden">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">L</span>
          </div>
          <span className="text-sm font-bold">Lynia</span>
        </div>

        <div className="hidden md:block">
          <p className="text-sm">
            Welcome back, <span className="font-semibold">{distributor?.name ?? 'Distributor'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 px-2.5 py-1.5 text-yellow-700 dark:text-yellow-300">
              <WifiOff className="h-3.5 w-3.5" />
              <span className="text-xs font-medium hidden sm:inline">Offline</span>
            </div>
          )}

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Moon className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {/* Notification bell with dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b last:border-b-0 ${
                          n.read ? 'opacity-60' : 'bg-primary/5'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                          </div>
                          {!n.read && (
                            <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:flex h-8 w-8 rounded-full bg-primary/10 items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {distributor?.name?.charAt(0) ?? 'D'}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
