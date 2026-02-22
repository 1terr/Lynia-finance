'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getOverdueCollections, type CollectionItem } from '@/lib/api/payments';
import { CollectionsQueue } from '@/components/payments/CollectionsQueue';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { formatCurrency, maskPhone } from '@lynia/utils';
import { exportToCsv } from '@/lib/export/csv';
import {
  CreditCard,
  AlertTriangle,
  Download,
  Search,
  Filter,
} from 'lucide-react';

type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

export default function CollectionsPage() {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['overdue-collections'],
    queryFn: getOverdueCollections,
    refetchInterval: 60000,
  });

  const filteredItems = items.filter((item: CollectionItem) => {
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.customer_name.toLowerCase().includes(q) ||
        item.customer_phone.includes(q)
      );
    }
    return true;
  });

  const totalOverdue = items.reduce((sum: number, i: CollectionItem) => sum + i.amount_due, 0);
  const criticalCount = items.filter((i: CollectionItem) => i.priority === 'critical').length;
  const highCount = items.filter((i: CollectionItem) => i.priority === 'high').length;

  const handleExportCSV = () => {
    // MED-17: Use the safe exportToCsv utility with formula-injection protection
    const headers = ['Customer', 'Phone', 'Amount Due', 'Days Overdue', 'Missed Payments', 'Priority'];
    const rows = filteredItems.map((item: CollectionItem) => [
      item.customer_name,
      maskPhone(item.customer_phone),
      item.amount_due.toFixed(2),
      item.days_overdue,
      item.missed_payments,
      item.priority,
    ]);
    exportToCsv(`collections-${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: 'payments', action: 'read' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/payments"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Payments
              </Link>
              <span className="text-gray-300">/</span>
              <span className="text-sm text-gray-700">Collections</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Collections Queue</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage overdue payment collections
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <CreditCard className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Overdue</p>
                <p className="text-lg font-semibold text-red-600">{formatCurrency(totalOverdue)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-50 p-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overdue Loans</p>
                <p className="text-lg font-semibold">{items.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Critical</p>
                <p className="text-lg font-semibold text-red-600">{criticalCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-50 p-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">High Priority</p>
                <p className="text-lg font-semibold text-yellow-600">{highCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical (60+ days)</option>
              <option value="high">High (30+ days)</option>
              <option value="medium">Medium (15+ days)</option>
              <option value="low">Low (&lt; 15 days)</option>
            </select>
          </div>
        </div>

        <CollectionsQueue items={filteredItems} isLoading={isLoading} />
      </div>
    </ProtectedRoute>
  );
}
