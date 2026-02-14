/**
 * Apache Fineract HTTP Client
 *
 * Typed HTTP client for calling the Fineract REST API from Lambda services.
 * Uses circuit breaker pattern for resilience and AWS Secrets Manager for
 * credential retrieval. All methods are idempotent-safe where possible.
 *
 * Usage:
 *   import { getFineractClient } from '../shared/clients/fineract';
 *   const fineract = await getFineractClient();
 *   const client = await fineract.createClient({ ... });
 */

import https from 'https';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { getSecret } from '../utils/secrets';
import type {
  FineractClientConfig,
  FineractClientCreateRequest,
  FineractClient,
  FineractCommandResponse,
  FineractErrorResponse,
  FineractLoanCreateRequest,
  FineractLoan,
  FineractLoanTransactionRequest,
  FineractLoanTransaction,
  FineractLoanProduct,
  FineractLoanProductCreateRequest,
  FineractGLAccount,
  FineractGLAccountCreateRequest,
  FineractJournalEntry,
  FineractOffice,
} from '../types/fineract';

// ============================================================
// CONFIGURATION
// ============================================================

const FINERACT_SECRET_NAME = process.env.FINERACT_SECRET_NAME || '';
const DEFAULT_TIMEOUT_MS = 30000;
const DATE_FORMAT = 'dd MMMM yyyy';
const LOCALE = 'en';

let cachedConfig: FineractClientConfig | null = null;

async function getConfig(): Promise<FineractClientConfig> {
  if (cachedConfig) return cachedConfig;

  if (!FINERACT_SECRET_NAME) {
    throw new Error('FINERACT_SECRET_NAME environment variable is not set');
  }

  const secret = (await getSecret(FINERACT_SECRET_NAME)) as unknown as {
    base_url: string;
    username: string;
    password: string;
    tenant_id: string;
  };

  cachedConfig = {
    baseUrl: secret.base_url,
    username: secret.username,
    password: secret.password,
    tenantId: secret.tenant_id,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  };

  return cachedConfig;
}

// ============================================================
// CIRCUIT BREAKER
// ============================================================

const fineractBreaker = new CircuitBreaker({
  name: 'fineract-api',
  failureThreshold: 5,
  resetTimeout: 60000,
  onOpen: (name, failures) => {
    console.error(`[fineract-client] Circuit OPEN after ${failures} failures`);
  },
  onClose: (_name) => {
    console.log(`[fineract-client] Circuit CLOSED (recovered)`);
  },
});

// ============================================================
// HTTP CLIENT
// ============================================================

class FineractApiError extends Error {
  public readonly statusCode: number;
  public readonly errorBody: FineractErrorResponse | null;

  constructor(message: string, statusCode: number, errorBody: FineractErrorResponse | null) {
    super(message);
    this.name = 'FineractApiError';
    this.statusCode = statusCode;
    this.errorBody = errorBody;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const config = await getConfig();

  return fineractBreaker.execute(async () => {
    const url = `${config.baseUrl}${path}`;
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const parsedUrl = new URL(url);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 8443,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Fineract-Platform-TenantId': config.tenantId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: config.timeoutMs,
      rejectUnauthorized: config.rejectUnauthorized,
    };

    if (bodyStr) {
      (options.headers as Record<string, string>)['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    return new Promise<T>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          const statusCode = res.statusCode || 0;

          if (statusCode >= 200 && statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) as T : ({} as T));
            } catch {
              reject(new FineractApiError(
                `Failed to parse Fineract response: ${data.substring(0, 200)}`,
                statusCode,
                null
              ));
            }
          } else {
            let errorBody: FineractErrorResponse | null = null;
            try {
              errorBody = JSON.parse(data) as FineractErrorResponse;
            } catch {
              // Response is not JSON
            }

            reject(new FineractApiError(
              `Fineract API error ${statusCode}: ${errorBody?.defaultUserMessage || data.substring(0, 200)}`,
              statusCode,
              errorBody
            ));
          }
        });
      });

      req.on('error', (err) => {
        reject(new FineractApiError(
          `Fineract connection error: ${err.message}`,
          0,
          null
        ));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new FineractApiError(
          `Fineract request timed out after ${config.timeoutMs}ms`,
          0,
          null
        ));
      });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  });
}

// ============================================================
// FINERACT CLIENT CLASS
// ============================================================

export class FineractClient {
  // ----------------------------------------------------------
  // OFFICES
  // ----------------------------------------------------------

  /** List all offices */
  async listOffices(): Promise<FineractOffice[]> {
    return request<FineractOffice[]>('GET', '/offices');
  }

  /** Get the head office (ID 1) */
  async getHeadOffice(): Promise<FineractOffice> {
    return request<FineractOffice>('GET', '/offices/1');
  }

  // ----------------------------------------------------------
  // CLIENTS
  // ----------------------------------------------------------

  /**
   * Create a new client in Fineract.
   * Called when a Lynia customer is approved after KYC.
   */
  async createClient(params: {
    firstName: string;
    lastName: string;
    mobileNo?: string;
    externalId: string; // Lynia customer UUID
    dateOfBirth?: string; // "dd MMMM yyyy"
    officeId?: number;
  }): Promise<FineractCommandResponse> {
    const today = formatFineractDate(new Date());

    const body: FineractClientCreateRequest = {
      officeId: params.officeId || 1,
      firstname: params.firstName,
      lastname: params.lastName,
      externalId: params.externalId,
      mobileNo: params.mobileNo,
      dateOfBirth: params.dateOfBirth,
      locale: LOCALE,
      dateFormat: DATE_FORMAT,
      active: true,
      activationDate: today,
      submittedOnDate: today,
    };

    return request<FineractCommandResponse>('POST', '/clients', body);
  }

  /** Get a client by Fineract ID */
  async getClient(clientId: number): Promise<FineractClient> {
    return request<FineractClient>('GET', `/clients/${clientId}`);
  }

  /** Get a client by external ID (Lynia customer UUID) */
  async getClientByExternalId(externalId: string): Promise<FineractClient> {
    return request<FineractClient>('GET', `/clients/external-id/${externalId}`);
  }

  // ----------------------------------------------------------
  // LOAN PRODUCTS
  // ----------------------------------------------------------

  /** List all loan products */
  async listLoanProducts(): Promise<FineractLoanProduct[]> {
    return request<FineractLoanProduct[]>('GET', '/loanproducts');
  }

  /** Get a specific loan product */
  async getLoanProduct(productId: number): Promise<FineractLoanProduct> {
    return request<FineractLoanProduct>('GET', `/loanproducts/${productId}`);
  }

  /** Create a new loan product */
  async createLoanProduct(
    product: FineractLoanProductCreateRequest
  ): Promise<FineractCommandResponse> {
    return request<FineractCommandResponse>('POST', '/loanproducts', product);
  }

  // ----------------------------------------------------------
  // LOANS
  // ----------------------------------------------------------

  /**
   * Create a loan application in Fineract.
   * The loan starts in "submitted and pending approval" state.
   */
  async createLoan(params: {
    clientId: number;
    productId: number;
    principal: number;
    numberOfRepayments: number;
    repaymentEveryMonths: number;
    interestRatePerMonth: number;
    expectedDisbursementDate: Date;
    externalId?: string; // Lynia loan UUID
  }): Promise<FineractCommandResponse> {
    const body: FineractLoanCreateRequest = {
      clientId: params.clientId,
      productId: params.productId,
      principal: params.principal,
      loanTermFrequency: params.numberOfRepayments * params.repaymentEveryMonths,
      loanTermFrequencyType: 2, // months
      numberOfRepayments: params.numberOfRepayments,
      repaymentEvery: params.repaymentEveryMonths,
      repaymentFrequencyType: 2, // months
      interestRatePerPeriod: params.interestRatePerMonth,
      amortizationType: 0, // equal installments
      interestType: 0, // declining balance
      interestCalculationPeriodType: 1, // same as repayment period
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      expectedDisbursementDate: formatFineractDate(params.expectedDisbursementDate),
      submittedOnDate: formatFineractDate(new Date()),
      locale: LOCALE,
      dateFormat: DATE_FORMAT,
      loanType: 'individual',
      externalId: params.externalId,
    };

    return request<FineractCommandResponse>('POST', '/loans', body);
  }

  /** Get a loan by Fineract ID */
  async getLoan(loanId: number, associations?: string[]): Promise<FineractLoan> {
    const assoc = associations?.length
      ? `?associations=${associations.join(',')}`
      : '';
    return request<FineractLoan>('GET', `/loans/${loanId}${assoc}`);
  }

  /** Get a loan by external ID (Lynia loan UUID) */
  async getLoanByExternalId(externalId: string): Promise<FineractLoan> {
    return request<FineractLoan>('GET', `/loans/external-id/${externalId}`);
  }

  /** Get loan with full repayment schedule */
  async getLoanWithSchedule(loanId: number): Promise<FineractLoan> {
    return this.getLoan(loanId, ['repaymentSchedule']);
  }

  /** Get loan with transactions */
  async getLoanWithTransactions(loanId: number): Promise<FineractLoan> {
    return this.getLoan(loanId, ['repaymentSchedule', 'transactions']);
  }

  /**
   * Approve a loan application.
   * Transitions: submittedAndPendingApproval → approved
   */
  async approveLoan(loanId: number, approvedOnDate?: Date): Promise<FineractCommandResponse> {
    const body = {
      approvedOnDate: formatFineractDate(approvedOnDate || new Date()),
      locale: LOCALE,
      dateFormat: DATE_FORMAT,
    };

    return request<FineractCommandResponse>('POST', `/loans/${loanId}?command=approve`, body);
  }

  /**
   * Disburse a loan.
   * Transitions: approved → active
   * Creates GL journal entries (debit loan portfolio, credit fund source).
   */
  async disburseLoan(
    loanId: number,
    actualDisbursementDate?: Date,
    paymentTypeId?: number
  ): Promise<FineractCommandResponse> {
    const body: Record<string, unknown> = {
      actualDisbursementDate: formatFineractDate(actualDisbursementDate || new Date()),
      locale: LOCALE,
      dateFormat: DATE_FORMAT,
    };

    if (paymentTypeId) {
      body.paymentTypeId = paymentTypeId;
    }

    return request<FineractCommandResponse>('POST', `/loans/${loanId}?command=disburse`, body);
  }

  /**
   * Post a repayment against a loan.
   * Reduces outstanding balance and creates GL journal entries.
   */
  async postRepayment(params: {
    loanId: number;
    amount: number;
    transactionDate: Date;
    paymentTypeId?: number;
    note?: string;
    externalId?: string; // Lynia payment UUID
  }): Promise<FineractCommandResponse> {
    const body: FineractLoanTransactionRequest = {
      transactionDate: formatFineractDate(params.transactionDate),
      transactionAmount: params.amount,
      paymentTypeId: params.paymentTypeId,
      note: params.note,
      locale: LOCALE,
      dateFormat: DATE_FORMAT,
      externalId: params.externalId,
    };

    return request<FineractCommandResponse>(
      'POST',
      `/loans/${params.loanId}/transactions?command=repayment`,
      body
    );
  }

  /**
   * Get a specific loan transaction
   */
  async getLoanTransaction(
    loanId: number,
    transactionId: number
  ): Promise<FineractLoanTransaction> {
    return request<FineractLoanTransaction>(
      'GET',
      `/loans/${loanId}/transactions/${transactionId}`
    );
  }

  // ----------------------------------------------------------
  // GL ACCOUNTS
  // ----------------------------------------------------------

  /** List all GL accounts */
  async listGLAccounts(): Promise<FineractGLAccount[]> {
    return request<FineractGLAccount[]>('GET', '/glaccounts');
  }

  /** Create a GL account */
  async createGLAccount(
    account: FineractGLAccountCreateRequest
  ): Promise<FineractCommandResponse> {
    return request<FineractCommandResponse>('POST', '/glaccounts', account);
  }

  // ----------------------------------------------------------
  // JOURNAL ENTRIES
  // ----------------------------------------------------------

  /** Search journal entries */
  async listJournalEntries(params?: {
    officeId?: number;
    glAccountId?: number;
    manualEntriesOnly?: boolean;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ totalFilteredRecords: number; pageItems: FineractJournalEntry[] }> {
    const queryParts: string[] = [];
    if (params?.officeId) queryParts.push(`officeId=${params.officeId}`);
    if (params?.glAccountId) queryParts.push(`glAccountId=${params.glAccountId}`);
    if (params?.manualEntriesOnly) queryParts.push(`manualEntriesOnly=${params.manualEntriesOnly}`);
    if (params?.fromDate) queryParts.push(`fromDate=${params.fromDate}`);
    if (params?.toDate) queryParts.push(`toDate=${params.toDate}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.offset) queryParts.push(`offset=${params.offset}`);

    const query = queryParts.length ? `?${queryParts.join('&')}` : '';

    return request<{ totalFilteredRecords: number; pageItems: FineractJournalEntry[] }>(
      'GET',
      `/journalentries${query}`
    );
  }

  // ----------------------------------------------------------
  // HEALTH CHECK
  // ----------------------------------------------------------

  /** Check if Fineract is healthy */
  async healthCheck(): Promise<boolean> {
    try {
      const config = await getConfig();
      const url = config.baseUrl.replace('/api/v1', '/actuator/health');
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      const parsedUrl = new URL(url);

      return new Promise<boolean>((resolve) => {
        const req = https.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 8443,
            path: parsedUrl.pathname,
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Fineract-Platform-TenantId': 'default',
            },
            timeout: 5000,
            rejectUnauthorized: config.rejectUnauthorized,
          },
          (res) => {
            resolve(res.statusCode === 200);
          }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });
    } catch {
      return false;
    }
  }

  /** Get circuit breaker state */
  getCircuitState(): string {
    return fineractBreaker.getState();
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Format a JS Date to Fineract date string: "dd MMMM yyyy"
 * Example: new Date('2026-02-14') → "14 February 2026"
 */
function formatFineractDate(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Parse a Fineract date array [year, month, day] to a JS Date
 */
export function parseFineractDate(date: [number, number, number]): Date {
  return new Date(date[0], date[1] - 1, date[2]);
}

/**
 * Format a money amount for display (USD with 2 decimal places)
 */
export function formatFineractMoney(amount: number, currencyCode = 'USD'): string {
  switch (currencyCode) {
    case 'USD':
      return `$${amount.toFixed(2)}`;
    case 'ZWL':
      return `ZWL ${amount.toFixed(2)}`;
    case 'ZAR':
      return `R${amount.toFixed(2)}`;
    default:
      return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

// ============================================================
// SINGLETON
// ============================================================

let clientInstance: FineractClient | null = null;

/**
 * Get the Fineract client singleton.
 * Lazily initializes and caches the config from Secrets Manager.
 */
export async function getFineractClient(): Promise<FineractClient> {
  if (!clientInstance) {
    // Warm the config cache
    await getConfig();
    clientInstance = new FineractClient();
  }
  return clientInstance;
}

export { FineractApiError };
