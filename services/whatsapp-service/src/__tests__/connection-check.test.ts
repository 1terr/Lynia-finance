/**
 * Tests for the WhatsApp connection check module.
 *
 * verifyConnection() proves the Lambda is bound to the correct business
 * phone number by querying Graph API metadata about the configured
 * Phone Number ID. These tests cover:
 *
 *  1. Missing env vars -> returns structured error, never throws
 *  2. Graph API success without expected-number assertion
 *  3. Graph API success WITH expected-number assertion (happy path)
 *  4. Graph API success but expected-number mismatch
 *  5. Expected-number comparison is format-agnostic (spaces/+ ignored)
 *  6. Axios error (non-2xx response) -> returns structured error
 *  7. Network error -> returns structured error
 */

jest.mock('../../../shared/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('axios');

import axios from 'axios';
import { verifyConnection, normalizePhoneNumber } from '../connection-check';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Preserve the real isAxiosError since we import it in the module under test
const realIsAxiosError = jest.requireActual('axios').isAxiosError;

describe('normalizePhoneNumber', () => {
  it('strips plus signs, spaces and dashes', () => {
    expect(normalizePhoneNumber('+263 71 925 2094')).toBe('263719252094');
    expect(normalizePhoneNumber('+263-71-925-2094')).toBe('263719252094');
    expect(normalizePhoneNumber('263719252094')).toBe('263719252094');
  });

  it('returns empty string for all non-digits', () => {
    expect(normalizePhoneNumber('+   ')).toBe('');
  });
});

describe('verifyConnection', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedAxios.isAxiosError = realIsAxiosError as unknown as typeof axios.isAxiosError;
    process.env = { ...ORIGINAL_ENV };
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_EXPECTED_DISPLAY_NUMBER;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns an error when WHATSAPP_PHONE_NUMBER_ID is missing', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';

    const result = await verifyConnection();

    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/WHATSAPP_PHONE_NUMBER_ID/);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns an error when WHATSAPP_ACCESS_TOKEN is missing', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';

    const result = await verifyConnection();

    expect(result.connected).toBe(false);
    expect(result.error).toMatch(/WHATSAPP_ACCESS_TOKEN/);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns connected=true on a successful Graph API call with no expected number', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: '1008788982315015',
        display_phone_number: '+263 71 925 2094',
        verified_name: 'Lynia Finance',
        quality_rating: 'GREEN',
        code_verification_status: 'VERIFIED',
      },
    });

    const result = await verifyConnection();

    expect(result.connected).toBe(true);
    expect(result.displayPhoneNumber).toBe('+263 71 925 2094');
    expect(result.verifiedName).toBe('Lynia Finance');
    expect(result.qualityRating).toBe('GREEN');
    expect(result.codeVerificationStatus).toBe('VERIFIED');
    expect(result.matchesExpected).toBeNull(); // no expected number configured
    expect(result.error).toBeNull();

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/1008788982315015',
      expect.objectContaining({
        params: {
          fields: 'display_phone_number,verified_name,quality_rating,code_verification_status',
        },
        headers: { Authorization: 'Bearer token' },
      })
    );
  });

  it('returns matchesExpected=true when the display number matches', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';
    process.env.WHATSAPP_EXPECTED_DISPLAY_NUMBER = '+263 71 925 2094';

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: '1008788982315015',
        display_phone_number: '+263 71 925 2094',
        verified_name: 'Lynia Finance',
        quality_rating: 'GREEN',
        code_verification_status: 'VERIFIED',
      },
    });

    const result = await verifyConnection();

    expect(result.connected).toBe(true);
    expect(result.matchesExpected).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns matchesExpected=false and an error when the display number differs', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';
    process.env.WHATSAPP_EXPECTED_DISPLAY_NUMBER = '+263 71 925 2094';

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: '1008788982315015',
        display_phone_number: '+1 555 191 0708', // old test number
        verified_name: 'Lynia Finance',
        quality_rating: 'GREEN',
        code_verification_status: 'VERIFIED',
      },
    });

    const result = await verifyConnection();

    expect(result.connected).toBe(false);
    expect(result.matchesExpected).toBe(false);
    expect(result.displayPhoneNumber).toBe('+1 555 191 0708');
    expect(result.error).toMatch(/mismatch/);
  });

  it('normalises formatting differences when comparing expected vs. actual', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';
    process.env.WHATSAPP_EXPECTED_DISPLAY_NUMBER = '263719252094'; // no + or spaces

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: '1008788982315015',
        display_phone_number: '+263 71 925 2094', // Meta format with + and spaces
        verified_name: 'Lynia Finance',
        quality_rating: 'GREEN',
        code_verification_status: 'VERIFIED',
      },
    });

    const result = await verifyConnection();

    expect(result.connected).toBe(true);
    expect(result.matchesExpected).toBe(true);
  });

  it('returns a Graph API error when the response is non-2xx', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';
    process.env.WHATSAPP_ACCESS_TOKEN = 'expired-token';

    const axiosError: {
      isAxiosError: true;
      response: { status: number; data: { error: { message: string } } };
      message: string;
    } = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: { message: 'Invalid OAuth access token' } },
      },
      message: 'Request failed with status code 401',
    };
    mockedAxios.isAxiosError = ((e: unknown): e is typeof axiosError =>
      typeof e === 'object' && e !== null && 'isAxiosError' in e) as unknown as typeof axios.isAxiosError;
    mockedAxios.get.mockRejectedValueOnce(axiosError);

    const result = await verifyConnection();

    expect(result.connected).toBe(false);
    expect(result.error).toContain('401');
    expect(result.error).toContain('Invalid OAuth access token');
  });

  it('returns a generic error on network failure', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1008788982315015';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token';

    mockedAxios.isAxiosError = ((_: unknown) => false) as unknown as typeof axios.isAxiosError;
    mockedAxios.get.mockRejectedValueOnce(new Error('socket hang up'));

    const result = await verifyConnection();

    expect(result.connected).toBe(false);
    expect(result.error).toBe('socket hang up');
  });
});
