import { exportDevicesToCSV } from '../devices';
import { mockDevices } from '@/test/mocks/devices';

describe('exportDevicesToCSV', () => {
  it('generates CSV with correct headers', () => {
    const csv = exportDevicesToCSV(mockDevices);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Device ID,Brand,Model,SKU,IMEI,Status,Retail Price,Financing Price,Deposit,Lock Enabled,Distributor,Warehouse'
    );
  });

  it('generates correct number of rows', () => {
    const csv = exportDevicesToCSV(mockDevices);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4); // 1 header + 3 devices
  });

  it('includes device data correctly', () => {
    const csv = exportDevicesToCSV(mockDevices);
    expect(csv).toContain('Samsung');
    expect(csv).toContain('Galaxy A14');
    expect(csv).toContain('SAM-A14-128-BLK');
    expect(csv).toContain('353456789012345');
    expect(csv).toContain('available');
    expect(csv).toContain('180.00');
    expect(csv).toContain('234.00');
    expect(csv).toContain('TechZone Harare');
  });

  it('handles devices without IMEI', () => {
    const devicesNoImei = [{ ...mockDevices[0], imei: null }];
    const csv = exportDevicesToCSV(devicesNoImei);
    const lines = csv.split('\n');
    // IMEI column should be empty
    const fields = lines[1].split(',');
    expect(fields[4]).toBe('');
  });

  it('handles devices without distributor', () => {
    const devicesNoDist = [{ ...mockDevices[0], distributors: undefined }];
    const csv = exportDevicesToCSV(devicesNoDist);
    const lines = csv.split('\n');
    const fields = lines[1].split(',');
    expect(fields[10]).toBe('');
  });

  it('shows lock enabled status', () => {
    const csv = exportDevicesToCSV(mockDevices);
    expect(csv).toContain('Yes');
  });

  it('returns only headers for empty array', () => {
    const csv = exportDevicesToCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
  });
});
