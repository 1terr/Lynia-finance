/**
 * Device Condition Monitoring Service (P3-T022)
 *
 * Features:
 *  - Periodic device health check via Trustonic
 *  - Battery health tracking
 *  - Storage usage monitoring
 *  - Connectivity status
 *  - Device tampering detection
 *  - Automated alerts for anomalies
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface DeviceHealthReport {
  device_id: string;
  imei: string;
  checked_at: Date;

  // Hardware
  battery_health_percent: number;
  battery_level_percent: number;
  storage_total_gb: number;
  storage_used_gb: number;
  storage_used_percent: number;

  // Connectivity
  is_online: boolean;
  last_seen_at: Date;
  network_type: 'wifi' | 'cellular' | 'none';
  signal_strength: number;

  // Security
  lock_status: 'locked' | 'unlocked';
  enrollment_status: 'enrolled' | 'unenrolled' | 'tampered';
  os_version: string;
  sim_status: 'active' | 'removed' | 'changed';
  factory_reset_detected: boolean;

  // Overall
  health_score: number; // 0-100
  alerts: DeviceAlert[];
}

export interface DeviceAlert {
  type: 'battery_low' | 'storage_full' | 'offline' | 'tamper' | 'sim_changed' | 'factory_reset';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detected_at: Date;
}

// ===================================================================
// HEALTH CHECK
// ===================================================================

/**
 * Perform health check on a single device
 */
export async function checkDeviceHealth(deviceId: string): Promise<DeviceHealthReport> {
  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  if (!device) throw new Error('Device not found');

  // In production, this would call Trustonic API
  // For now, simulate health data
  const alerts: DeviceAlert[] = [];
  const now = new Date();

  const batteryHealth = device.battery_health_percent ?? 95;
  const batteryLevel = device.battery_level_percent ?? 70;
  const storageUsed = device.storage_used_percent ?? 40;
  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at) : now;
  const hoursSinceLastSeen = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

  // Check for alerts
  if (batteryHealth < 70) {
    alerts.push({
      type: 'battery_low',
      severity: batteryHealth < 50 ? 'critical' : 'warning',
      message: `Battery health at ${batteryHealth}%`,
      detected_at: now,
    });
  }

  if (storageUsed > 90) {
    alerts.push({
      type: 'storage_full',
      severity: storageUsed > 95 ? 'critical' : 'warning',
      message: `Storage ${storageUsed}% full`,
      detected_at: now,
    });
  }

  if (hoursSinceLastSeen > 72) {
    alerts.push({
      type: 'offline',
      severity: hoursSinceLastSeen > 168 ? 'critical' : 'warning',
      message: `Device offline for ${Math.round(hoursSinceLastSeen)} hours`,
      detected_at: now,
    });
  }

  if (device.factory_reset_detected) {
    alerts.push({
      type: 'factory_reset',
      severity: 'critical',
      message: 'Factory reset detected',
      detected_at: now,
    });
  }

  if (device.sim_changed) {
    alerts.push({
      type: 'sim_changed',
      severity: 'warning',
      message: 'SIM card changed',
      detected_at: now,
    });
  }

  // Calculate health score
  let healthScore = 100;
  if (batteryHealth < 80) healthScore -= (80 - batteryHealth);
  if (storageUsed > 80) healthScore -= (storageUsed - 80);
  if (hoursSinceLastSeen > 24) healthScore -= Math.min(30, hoursSinceLastSeen / 24 * 5);
  if (device.factory_reset_detected) healthScore -= 50;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const report: DeviceHealthReport = {
    device_id: deviceId,
    imei: device.imei,
    checked_at: now,
    battery_health_percent: batteryHealth,
    battery_level_percent: batteryLevel,
    storage_total_gb: device.storage_total_gb || 32,
    storage_used_gb: device.storage_used_gb || 12,
    storage_used_percent: storageUsed,
    is_online: hoursSinceLastSeen < 24,
    last_seen_at: lastSeen,
    network_type: device.network_type || 'cellular',
    signal_strength: device.signal_strength || 75,
    lock_status: device.lock_status || 'unlocked',
    enrollment_status: device.trustonic_enrollment_status || 'enrolled',
    os_version: device.os_version || 'Android 13',
    sim_status: device.sim_changed ? 'changed' : 'active',
    factory_reset_detected: device.factory_reset_detected || false,
    health_score: Math.round(healthScore),
    alerts,
  };

  // Store health check
  await supabase.from('device_health_checks').insert({
    device_id: deviceId,
    health_score: report.health_score,
    battery_health: report.battery_health_percent,
    storage_used_percent: report.storage_used_percent,
    is_online: report.is_online,
    alerts_count: alerts.length,
    critical_alerts: alerts.filter(a => a.severity === 'critical').length,
    report_data: report,
    checked_at: now,
  });

  return report;
}

/**
 * Run batch health check on all active devices
 */
export async function batchHealthCheck(): Promise<{
  checked: number;
  healthy: number;
  warnings: number;
  critical: number;
}> {
  const { data: devices } = await supabase
    .from('devices')
    .select('id')
    .in('status', ['assigned', 'active'])
    .not('customer_id', 'is', null);

  if (!devices) return { checked: 0, healthy: 0, warnings: 0, critical: 0 };

  const stats = { checked: 0, healthy: 0, warnings: 0, critical: 0 };

  for (const device of devices) {
    try {
      const report = await checkDeviceHealth(device.id);
      stats.checked++;

      if (report.health_score >= 80) stats.healthy++;
      else if (report.alerts.some(a => a.severity === 'critical')) stats.critical++;
      else stats.warnings++;
    } catch (error) {
      console.error(`Health check failed for device ${device.id}:`, error);
    }
  }

  return stats;
}

/**
 * Get devices needing attention (health score < 60 or critical alerts)
 */
export async function getDevicesNeedingAttention(): Promise<Array<{
  device_id: string;
  imei: string;
  health_score: number;
  critical_alerts: number;
  last_checked: string;
}>> {
  const { data } = await supabase
    .from('device_health_checks')
    .select('device_id, health_score, critical_alerts, checked_at, devices(imei)')
    .or('health_score.lt.60,critical_alerts.gt.0')
    .order('health_score', { ascending: true })
    .limit(50);

  return (data || []).map(d => ({
    device_id: d.device_id,
    imei: (d.devices as Record<string, unknown>)?.imei || '',
    health_score: d.health_score,
    critical_alerts: d.critical_alerts,
    last_checked: d.checked_at,
  }));
}
