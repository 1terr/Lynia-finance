import { fetchAPI } from '@lynia/api-client';

export interface GlobalSearchResult {
  results: {
    customers: Array<{
      id: string;
      first_name: string;
      last_name: string;
      phone_number: string;
      national_id: string;
      kyc_status: string;
      status: string;
      loan_count: number;
      payment_count: number;
      device_count: number;
    }>;
    loans: Array<{
      id: string;
      loan_number: string;
      status: string;
      outstanding_balance_usd: number;
      customer_id: string;
      customer_name: string;
      days_past_due: number;
    }>;
    payments: Array<{
      id: string;
      reference_number: string;
      amount_usd: number;
      status: string;
      payment_date: string;
      customer_id: string;
      customer_name: string;
    }>;
    devices: Array<{
      id: string;
      imei: string;
      manufacturer: string;
      model: string;
      status: string;
      customer_id: string;
      customer_name: string;
    }>;
  };
  query: string;
  total: number;
}

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const params = new URLSearchParams();
  params.set('q', query);

  return fetchAPI<GlobalSearchResult>(`/api/v1/search?${params.toString()}`);
}
