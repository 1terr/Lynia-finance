/**
 * Apache Fineract HTTP Client
 *
 * Typed HTTP client for calling the Fineract REST API from Lambda services.
 * Uses circuit breaker pattern for resilience and AWS Secrets Manager for
 * credential retrieval. All methods are idempotent-safe where possible.
 *
 * Domain-specific operations have been decomposed into:
 *  - fineract/client-client.ts  -- customer/client and office operations
 *  - fineract/loan-client.ts    -- loan CRUD, approval, disbursement, repayment
 *  - fineract/charge-client.ts  -- GL accounts, journal entries, interop, health, reports
 *  - fineract/savings-client.ts -- savings account operations (future)
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
  FineractErrorResponse,
} from '../types/fineract';
import { createClientOperations } from './fineract/client-client';
import { createLoanOperations } from './fineract/loan-client';
import { createChargeOperations } from './fineract/charge-client';

// ============================================================
// CONFIGURATION
// ============================================================

const FINERACT_SECRET_NAME = process.env.FINERACT_SECRET_NAME || '';
const DEFAULT_TIMEOUT_MS = 30000;

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

  if (!cachedConfig.rejectUnauthorized) {
    console.warn('[fineract-client] TLS certificate validation disabled (non-production environment)');
  }

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

/**
 * Format a JS Date to Fineract date string: "dd MMMM yyyy"
 * Example: new Date('2026-02-14') -> "14 February 2026"
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

export class FineractClient {
  private _clientOps = createClientOperations(request, formatFineractDate);
  private _loanOps = createLoanOperations(request, formatFineractDate);
  private _chargeOps = createChargeOperations(request, getConfig, () => fineractBreaker.getState());

  // -- Client/Office operations --
  listOffices = this._clientOps.listOffices;
  getHeadOffice = this._clientOps.getHeadOffice;
  createClient = this._clientOps.createClient;
  getClient = this._clientOps.getClient;
  getClientByExternalId = this._clientOps.getClientByExternalId;

  // -- Loan Product operations --
  listLoanProducts = this._loanOps.listLoanProducts;
  getLoanProduct = this._loanOps.getLoanProduct;
  createLoanProduct = this._loanOps.createLoanProduct;

  // -- Loan operations --
  createLoan = this._loanOps.createLoan;
  getLoan = this._loanOps.getLoan;
  getLoanByExternalId = this._loanOps.getLoanByExternalId;
  getLoanWithSchedule = this._loanOps.getLoanWithSchedule;
  getLoanWithTransactions = this._loanOps.getLoanWithTransactions;
  approveLoan = this._loanOps.approveLoan;
  disburseLoan = this._loanOps.disburseLoan;
  postRepayment = this._loanOps.postRepayment;
  getLoanTransaction = this._loanOps.getLoanTransaction;

  // -- GL/Accounting operations --
  listGLAccounts = this._chargeOps.listGLAccounts;
  createGLAccount = this._chargeOps.createGLAccount;
  listJournalEntries = this._chargeOps.listJournalEntries;

  // -- Interop operations --
  registerInteropParty = this._chargeOps.registerInteropParty;
  lookupInteropParty = this._chargeOps.lookupInteropParty;
  deleteInteropParty = this._chargeOps.deleteInteropParty;
  prepareInteropTransfer = this._chargeOps.prepareInteropTransfer;
  commitInteropTransfer = this._chargeOps.commitInteropTransfer;
  releaseInteropTransfer = this._chargeOps.releaseInteropTransfer;
  getInteropTransfer = this._chargeOps.getInteropTransfer;
  interopHealthCheck = this._chargeOps.interopHealthCheck;

  // -- Health/Reports --
  healthCheck = this._chargeOps.healthCheck;
  listReports = this._chargeOps.listReports;
  runReport = this._chargeOps.runReport;
  getCircuitState = this._chargeOps.getCircuitState;
}

// ============================================================
// HELPERS
// ============================================================

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
