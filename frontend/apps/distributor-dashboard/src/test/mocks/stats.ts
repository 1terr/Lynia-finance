import type { DashboardStats } from '@/types/distributor';
import { mockDistributor } from './distributor';
import { mockPendingHandovers } from './handovers';

export const mockDashboardStats: DashboardStats = {
  total_devices_distributed: mockDistributor.total_devices_distributed,
  current_inventory: mockDistributor.current_inventory_count,
  pending_handovers: mockPendingHandovers.filter((h) => h.status === 'pending').length,
  total_commissions_earned: mockDistributor.total_commissions_earned,
  total_commissions_paid: mockDistributor.total_commissions_paid,
  pending_commissions: mockDistributor.pending_commissions,
  average_rating: mockDistributor.average_rating,
  monthly_handovers: 6,
};
