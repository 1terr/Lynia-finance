'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useConnectionQuality } from '@/lib/hooks/use-connection-quality';
import { useScrollDirection } from '@/lib/hooks/use-scroll-direction';
import { useTheme } from 'next-themes';
import { Bell, Sun, Moon, WifiOff, Wifi, X } from 'lucide-react';

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
  const connectionQuality = useConnectionQuality();
  const scrollDirection = useScrollDirection();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close desktop dropdown on outside click
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

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (showNotifications) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showNotifications]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const notificationList = (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => setShowNotifications(false)}
            className="p-1 rounded-lg hover:bg-muted transition-colors md:hidden touch-target"
            aria-label="Close notifications"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="max-h-[60vh] md:max-h-72 overflow-y-auto">
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
                  <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                </div>
                {!n.read && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Connection quality banner */}
      {connectionQuality !== 'good' && (
        <div
          className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium ${
            connectionQuality === 'offline'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
          }`}
        >
          {connectionQuality === 'offline' ? (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span>You&apos;re offline. Showing cached data.</span>
            </>
          ) : (
            <>
              <Wifi className="h-3.5 w-3.5" />
              <span>Slow connection detected</span>
            </>
          )}
        </div>
      )}

      <header className={`sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 md:px-6 transition-transform duration-200 ${scrollDirection === 'down' ? '-translate-y-full md:translate-y-0' : 'translate-y-0'}`}>
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

        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-lg hover:bg-muted transition-colors touch-target"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Moon className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {/* Notification bell */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="relative p-2.5 rounded-lg hover:bg-muted transition-colors touch-target"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Desktop dropdown */}
            {showNotifications && (
              <div className="hidden md:block absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg overflow-hidden">
                {notificationList}
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

      {/* Mobile notification bottom sheet */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={() => setShowNotifications(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-card shadow-2xl md:hidden animate-in slide-in-from-bottom duration-200 safe-area-bottom">
            <div className="flex justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            {notificationList}
          </div>
        </>
      )}
    </>
  );
}
