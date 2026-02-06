import type {
  Distributor,
  PendingHandover,
  InventoryDevice,
  CommissionEntry,
  DashboardStats,
  HandoverResult,
  DeviceCondition,
} from '@/types/distributor';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mockDistributor: Distributor = {
  id: 'dist_001',
  user_id: 'usr_dist_001',
  name: 'Kudzai Maposa',
  phone_number: '+263771234567',
  email: 'kudzai@distributor.co.zw',
  national_id: '63-234567B89',
  business_name: 'Maposa Mobile Solutions',
  province: 'Harare',
  city: 'Harare',
  address: '45 Samora Machel Ave, Harare CBD',
  latitude: -17.8292,
  longitude: 31.0522,
  bank_name: 'CBZ Bank',
  account_number: '1234567890',
  mobile_money_number: '+263771234567',
  commission_rate: 5.0,
  total_commissions_earned: 625.00,
  total_commissions_paid: 500.00,
  pending_commissions: 125.00,
  total_loans_disbursed: 42,
  total_devices_distributed: 42,
  current_inventory_count: 8,
  average_rating: 4.6,
  status: 'active',
  kyc_status: 'approved',
  kyc_verified_at: '2025-11-01T00:00:00Z',
  onboarded_at: '2025-10-15T00:00:00Z',
  created_at: '2025-10-15T00:00:00Z',
};

const mockPendingHandovers: PendingHandover[] = [
  {
    id: 'ho_001', loan_id: 'LYN-2026-091', customer_name: 'Farai Mupfumi',
    customer_phone: '+263772111222', device_model: 'Samsung Galaxy A14',
    device_imei: '351234567890123', loan_amount: 200, deposit_amount: 40,
    deposit_paid: false, scheduled_date: '2026-02-07T10:00:00Z',
    status: 'pending', created_at: '2026-02-05T08:00:00Z',
  },
  {
    id: 'ho_002', loan_id: 'LYN-2026-093', customer_name: 'Nyasha Chirwa',
    customer_phone: '+263773222333', device_model: 'Tecno Spark 10',
    device_imei: '351234567890456', loan_amount: 200, deposit_amount: 40,
    deposit_paid: true, scheduled_date: '2026-02-07T14:00:00Z',
    status: 'pending', created_at: '2026-02-05T10:30:00Z',
  },
  {
    id: 'ho_003', loan_id: 'LYN-2026-095', customer_name: 'Tendai Gumbo',
    customer_phone: '+263774333444', device_model: 'Samsung Galaxy A15',
    device_imei: '351234567890789', loan_amount: 350, deposit_amount: 70,
    deposit_paid: false, scheduled_date: '2026-02-08T09:00:00Z',
    status: 'pending', created_at: '2026-02-06T07:00:00Z',
  },
];

const mockInventory: InventoryDevice[] = [
  { id: 'dev_001', brand: 'Samsung', model: 'Galaxy A14', imei: '351000000000001', retail_price: 200, status: 'available', condition: 'new', received_at: '2026-01-20T00:00:00Z' },
  { id: 'dev_002', brand: 'Samsung', model: 'Galaxy A14', imei: '351000000000002', retail_price: 200, status: 'available', condition: 'new', received_at: '2026-01-20T00:00:00Z' },
  { id: 'dev_003', brand: 'Tecno', model: 'Spark 10', imei: '351000000000003', retail_price: 200, status: 'reserved', condition: 'new', received_at: '2026-01-25T00:00:00Z' },
  { id: 'dev_004', brand: 'Samsung', model: 'Galaxy A15', imei: '351000000000004', retail_price: 350, status: 'available', condition: 'new', received_at: '2026-02-01T00:00:00Z' },
  { id: 'dev_005', brand: 'Samsung', model: 'Galaxy A15', imei: '351000000000005', retail_price: 350, status: 'reserved', condition: 'new', received_at: '2026-02-01T00:00:00Z' },
  { id: 'dev_006', brand: 'Samsung', model: 'Galaxy A25', imei: '351000000000006', retail_price: 500, status: 'available', condition: 'new', received_at: '2026-02-03T00:00:00Z' },
  { id: 'dev_007', brand: 'Xiaomi', model: 'Redmi 13C', imei: '351000000000007', retail_price: 200, status: 'available', condition: 'new', received_at: '2026-02-03T00:00:00Z' },
  { id: 'dev_008', brand: 'Tecno', model: 'Camon 20', imei: '351000000000008', retail_price: 350, status: 'damaged', condition: 'new', received_at: '2026-01-15T00:00:00Z' },
];

const mockCommissions: CommissionEntry[] = [
  { id: 'com_001', loan_id: 'LYN-2026-045', device_model: 'Samsung Galaxy A14', customer_name: 'Tapiwa Ndoro', device_retail_price: 200, commission_percentage: 5.0, commission_amount: 10.00, payment_status: 'paid', calculation_date: '2026-01-10T00:00:00Z', paid_at: '2026-01-15T00:00:00Z' },
  { id: 'com_002', loan_id: 'LYN-2026-051', device_model: 'Samsung Galaxy A15', customer_name: 'Rumbidzai Moyo', device_retail_price: 350, commission_percentage: 5.0, commission_amount: 17.50, payment_status: 'paid', calculation_date: '2026-01-15T00:00:00Z', paid_at: '2026-01-20T00:00:00Z' },
  { id: 'com_003', loan_id: 'LYN-2026-067', device_model: 'Samsung Galaxy A25', customer_name: 'Blessing Phiri', device_retail_price: 500, commission_percentage: 5.0, commission_amount: 25.00, payment_status: 'paid', calculation_date: '2026-01-22T00:00:00Z', paid_at: '2026-01-28T00:00:00Z' },
  { id: 'com_004', loan_id: 'LYN-2026-078', device_model: 'Tecno Spark 10', customer_name: 'Chiedza Gumbo', device_retail_price: 200, commission_percentage: 5.0, commission_amount: 10.00, payment_status: 'paid', calculation_date: '2026-01-28T00:00:00Z', paid_at: '2026-02-02T00:00:00Z' },
  { id: 'com_005', loan_id: 'LYN-2026-085', device_model: 'Samsung Galaxy A15', customer_name: 'Tatenda Chirwa', device_retail_price: 350, commission_percentage: 5.0, commission_amount: 17.50, payment_status: 'pending', calculation_date: '2026-02-03T00:00:00Z', paid_at: null },
  { id: 'com_006', loan_id: 'LYN-2026-088', device_model: 'Samsung Galaxy A14', customer_name: 'Tinotenda Marufu', device_retail_price: 200, commission_percentage: 5.0, commission_amount: 10.00, payment_status: 'pending', calculation_date: '2026-02-05T00:00:00Z', paid_at: null },
];

export async function fetchDistributorProfile(): Promise<Distributor> {
  await delay(400);
  return { ...mockDistributor };
}

export async function updateDistributorProfile(updates: Partial<Distributor>): Promise<Distributor> {
  await delay(400);
  Object.assign(mockDistributor, updates);
  return { ...mockDistributor };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  await delay(400);
  return {
    total_devices_distributed: mockDistributor.total_devices_distributed,
    current_inventory: mockDistributor.current_inventory_count,
    pending_handovers: mockPendingHandovers.filter((h) => h.status === 'pending').length,
    total_commissions_earned: mockDistributor.total_commissions_earned,
    total_commissions_paid: mockDistributor.total_commissions_paid,
    pending_commissions: mockDistributor.pending_commissions,
    average_rating: mockDistributor.average_rating,
    monthly_handovers: 6,
  };
}

export async function fetchPendingHandovers(): Promise<PendingHandover[]> {
  await delay(400);
  return [...mockPendingHandovers];
}

export async function fetchInventory(): Promise<InventoryDevice[]> {
  await delay(400);
  return [...mockInventory];
}

export async function fetchCommissions(): Promise<CommissionEntry[]> {
  await delay(400);
  return [...mockCommissions];
}

export async function loginDistributor(email: string, _password: string): Promise<Distributor> {
  await delay(800);
  if (email === 'kudzai@distributor.co.zw') {
    return { ...mockDistributor };
  }
  throw new Error('Invalid credentials');
}

// ── Handover API ──

export async function verifyCustomerIdentity(
  handoverId: string,
  nationalId: string,
): Promise<{ verified: boolean; message: string }> {
  await delay(800);
  const handover = mockPendingHandovers.find((h) => h.id === handoverId);
  if (!handover) return { verified: false, message: 'Handover not found' };
  // Simulate: any valid-looking Zim ID passes
  const valid = /^\d{2}-\d{6,7}[A-Z]\d{2}$/.test(nationalId);
  return {
    verified: valid,
    message: valid ? 'Identity verified successfully' : 'Invalid National ID format',
  };
}

export async function verifyImei(
  _handoverId: string,
  imei: string,
  expectedImei: string,
): Promise<{ verified: boolean; message: string }> {
  await delay(600);
  const valid = imei.length === 15 && /^\d{15}$/.test(imei);
  if (!valid) return { verified: false, message: 'IMEI must be exactly 15 digits' };
  const matches = imei === expectedImei;
  return {
    verified: matches,
    message: matches ? 'IMEI verified — matches device record' : 'IMEI does not match the assigned device',
  };
}

export async function verifyDepositPayment(
  _handoverId: string,
  paymentMethod: string,
  transactionRef: string,
): Promise<{ verified: boolean; amount: number; message: string }> {
  await delay(1000);
  if (!transactionRef || transactionRef.length < 4) {
    return { verified: false, amount: 0, message: 'Invalid transaction reference' };
  }
  return {
    verified: true,
    amount: 40,
    message: `Deposit of $40.00 verified via ${paymentMethod}`,
  };
}

export async function submitHandover(data: {
  handover_id: string;
  customer_national_id: string;
  scanned_imei: string;
  device_condition: DeviceCondition;
  device_photos: string[];
  signature_data_url: string;
  deposit_payment_method: string;
  deposit_transaction_ref: string;
}): Promise<HandoverResult> {
  await delay(1200);
  const handover = mockPendingHandovers.find((h) => h.id === data.handover_id);
  if (!handover) throw new Error('Handover not found');
  const commission = handover.loan_amount * 0.05;
  const nextPayment = new Date();
  nextPayment.setDate(nextPayment.getDate() + 30);
  return {
    success: true,
    handover_id: data.handover_id,
    loan_id: handover.loan_id,
    commission_amount: commission,
    next_payment_date: nextPayment.toISOString(),
    message: `Device handed over to ${handover.customer_name}. Loan ${handover.loan_id} is now active.`,
  };
}
