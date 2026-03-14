/**
 * Fineract Charge/Fee & Accounting Operations
 *
 * GL accounts, journal entries, reports, interop module, and health checks.
 */

import https from 'https';
import type {
  FineractClientConfig,
  FineractCommandResponse,
  FineractGLAccount,
  FineractGLAccountCreateRequest,
  FineractJournalEntry,
  InteropIdentifierType,
  FineractInteropPartyResponse,
  FineractInteropTransferRequest,
  FineractInteropTransferResponse,
  FineractInteropHealthResponse,
} from '../../types/fineract';

type RequestFn = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<T>;

/**
 * Create charge/accounting-related operations bound to a request function
 */
export function createChargeOperations(
  request: RequestFn,
  getConfig: () => Promise<FineractClientConfig>,
  getCircuitState: () => string
) {
  return {
    // ----------------------------------------------------------
    // GL ACCOUNTS
    // ----------------------------------------------------------

    /** List all GL accounts */
    async listGLAccounts(): Promise<FineractGLAccount[]> {
      return request<FineractGLAccount[]>('GET', '/glaccounts');
    },

    /** Create a GL account */
    async createGLAccount(
      account: FineractGLAccountCreateRequest
    ): Promise<FineractCommandResponse> {
      return request<FineractCommandResponse>('POST', '/glaccounts', account);
    },

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

      const queryStr = queryParts.length ? `?${queryParts.join('&')}` : '';

      return request<{ totalFilteredRecords: number; pageItems: FineractJournalEntry[] }>(
        'GET',
        `/journalentries${queryStr}`
      );
    },

    // ----------------------------------------------------------
    // INTEROPERATION MODULE (Mojaloop-compatible)
    // ----------------------------------------------------------

    /**
     * Register a party identifier (e.g., MSISDN) for a Fineract account.
     */
    async registerInteropParty(params: {
      idType: InteropIdentifierType;
      idValue: string;
      accountId: string;
      subIdOrType?: string;
    }): Promise<FineractCommandResponse> {
      const path = params.subIdOrType
        ? `/interoperation/parties/${params.idType}/${params.idValue}/${params.subIdOrType}`
        : `/interoperation/parties/${params.idType}/${params.idValue}`;

      return request<FineractCommandResponse>('POST', path, {
        accountId: params.accountId,
      });
    },

    /**
     * Look up a party by identifier (e.g., MSISDN).
     */
    async lookupInteropParty(params: {
      idType: InteropIdentifierType;
      idValue: string;
      subIdOrType?: string;
    }): Promise<FineractInteropPartyResponse> {
      const path = params.subIdOrType
        ? `/interoperation/parties/${params.idType}/${params.idValue}/${params.subIdOrType}`
        : `/interoperation/parties/${params.idType}/${params.idValue}`;

      return request<FineractInteropPartyResponse>('GET', path);
    },

    /**
     * Delete a party identifier registration.
     */
    async deleteInteropParty(params: {
      idType: InteropIdentifierType;
      idValue: string;
      subIdOrType?: string;
    }): Promise<void> {
      const path = params.subIdOrType
        ? `/interoperation/parties/${params.idType}/${params.idValue}/${params.subIdOrType}`
        : `/interoperation/parties/${params.idType}/${params.idValue}`;

      await request<void>('DELETE', path);
    },

    /**
     * Prepare an interop transfer (Phase 1 of two-phase commit).
     */
    async prepareInteropTransfer(
      transfer: FineractInteropTransferRequest
    ): Promise<FineractInteropTransferResponse> {
      return request<FineractInteropTransferResponse>(
        'POST',
        '/interoperation/transfers',
        { ...transfer, action: 'PREPARE' }
      );
    },

    /**
     * Commit a previously prepared interop transfer (Phase 2).
     */
    async commitInteropTransfer(
      transferId: string
    ): Promise<FineractInteropTransferResponse> {
      return request<FineractInteropTransferResponse>(
        'PUT',
        `/interoperation/transfers/${transferId}`,
        { transferState: 'COMMITTED' }
      );
    },

    /**
     * Release (abort) a previously prepared interop transfer.
     */
    async releaseInteropTransfer(
      transferId: string
    ): Promise<FineractInteropTransferResponse> {
      return request<FineractInteropTransferResponse>(
        'PUT',
        `/interoperation/transfers/${transferId}`,
        { transferState: 'ABORTED' }
      );
    },

    /**
     * Get the status of an interop transfer.
     */
    async getInteropTransfer(
      transferId: string
    ): Promise<FineractInteropTransferResponse> {
      return request<FineractInteropTransferResponse>(
        'GET',
        `/interoperation/transfers/${transferId}`
      );
    },

    /**
     * Check if the interop module is healthy and enabled.
     */
    async interopHealthCheck(): Promise<FineractInteropHealthResponse | null> {
      try {
        return await request<FineractInteropHealthResponse>(
          'GET',
          '/interoperation/health'
        );
      } catch {
        return null;
      }
    },

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
              ...(process.env.FINERACT_TLS_SERVERNAME && {
                servername: process.env.FINERACT_TLS_SERVERNAME,
              }),
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
    },

    // ----------------------------------------------------------
    // REPORTS
    // ----------------------------------------------------------

    /** List available Fineract report definitions */
    async listReports(): Promise<Array<{ id: number; reportName: string; reportType: string; reportSubType: string; reportCategory: string; description: string }>> {
      return request<Array<{ id: number; reportName: string; reportType: string; reportSubType: string; reportCategory: string; description: string }>>('GET', '/reports');
    },

    /** Run a named Fineract report with query parameters */
    async runReport(reportName: string, params?: Record<string, string>): Promise<unknown> {
      const queryStr = params
        ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
        : '';
      return request<unknown>('GET', `/runreports/${encodeURIComponent(reportName)}${queryStr}`);
    },

    /** Get circuit breaker state */
    getCircuitState(): string {
      return getCircuitState();
    },
  };
}
