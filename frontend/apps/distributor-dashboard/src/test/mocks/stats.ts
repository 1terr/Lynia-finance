import type { DashboardStats } from '@/types/distributor';
import { mockDistributor } from './distributor';

export const mockDashboardStats: DashboardStats = {
  total_devices_distributed: mockDistributor.total_devices_distributed,
  current_inventory: mockDistributor.current_inventory_count,
  total_commissions_earned: mockDistributor.total_commissions_earned,
  total_commissions_paid: mockDistributor.total_commissions_paid,
  pending_commissions: mockDistributor.pending_commissions,
  average_rating: mockDistributor.average_rating,
  monthly_handovers: 6,
  last_month_handovers: 4,
};
