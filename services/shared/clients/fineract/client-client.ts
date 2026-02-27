/**
 * Fineract Client (Customer) Operations
 *
 * CRUD operations for Fineract clients (customers) and offices.
 */

import type {
  FineractClientCreateRequest,
  FineractClient as FineractClientData,
  FineractCommandResponse,
  FineractOffice,
} from '../../types/fineract';

const DATE_FORMAT = 'dd MMMM yyyy';
const LOCALE = 'en';

type RequestFn = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<T>;

/**
 * Create client-related operations bound to a request function
 */
export function createClientOperations(request: RequestFn, formatDate: (d: Date) => string) {
  return {
    /** List all offices */
    async listOffices(): Promise<FineractOffice[]> {
      return request<FineractOffice[]>('GET', '/offices');
    },

    /** Get the head office (ID 1) */
    async getHeadOffice(): Promise<FineractOffice> {
      return request<FineractOffice>('GET', '/offices/1');
    },

    /**
     * Create a new client in Fineract.
     * Called when a Lynia customer is approved after KYC.
     */
    async createClient(params: {
      firstName: string;
      lastName: string;
      mobileNo?: string;
      externalId: string;
      dateOfBirth?: string;
      officeId?: number;
    }): Promise<FineractCommandResponse> {
      const today = formatDate(new Date());

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
    },

    /** Get a client by Fineract ID */
    async getClient(clientId: number): Promise<FineractClientData> {
      return request<FineractClientData>('GET', `/clients/${clientId}`);
    },

    /** Get a client by external ID (Lynia customer UUID) */
    async getClientByExternalId(externalId: string): Promise<FineractClientData> {
      return request<FineractClientData>('GET', `/clients/external-id/${externalId}`);
    },
  };
}
