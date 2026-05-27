/**
 * OLT Driver Abstraction Layer
 * Unified interface for ZTE, Huawei, and VSOL OLT management
 */

export interface OltConnStr {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: 'ssh' | 'telnet';
  vendor?: 'zte' | 'huawei' | 'vsol';
  readyTimeout?: number;
}

export interface OnuInfo {
  onuId: string;       // e.g. "1/1/1:1" (ZTE) or "0/1/1/1" (Huawei)
  sn: string;
  board: string;
  port: string;
  state: 'working' | 'offline' | 'los' | 'degraded' | 'unknown';
  rxPower: number | null; // dBm, null if not available
  txPower: number | null;
  distance: number | null; // meters
  onuType?: string;
  name?: string;
  uptime?: string;
  vendor?: string;
}

export interface UncfgOnu {
  board: string;
  port: string;
  sn: string;
  state: string;
  type?: string;
  llid?: string;
}

export interface OnuAlarmInfo {
  onuId: string;
  sn: string;
  board: string;
  port: string;
  alarmType: 'LOS' | 'OFFLINE' | 'WEAK_SIGNAL' | 'DEGRADED' | 'RESTORED';
  rxPower: number | null;
  threshold?: number;
  description: string;
}

export interface PonPortInfo {
  board: string;
  port: string;
  totalOnus: number;
  activeOnus: number;
  offlineOnus: number;
  losOnus: number;
  capacity: number; // max ONUs per port (usually 128)
  utilization: number; // 0-100 percentage
}

export interface OltDashboardData {
  totalOnus: number;
  activeOnus: number;
  offlineOnus: number;
  losOnus: number;
  weakSignalOnus: number;
  ponPorts: PonPortInfo[];
  onus: OnuInfo[];
  lastSync: Date;
}

export interface RegisterOnuParams {
  board: string;
  port: string;
  sn: string;
  name: string;
  vlan: string;
  mode?: 'bridge' | 'pppoe';
  onuType?: string;
  profile?: string;
  vlanProfile?: string;
  vlanAcs?: string;
  acsUrl?: string;
  acsUser?: string;
  acsPass?: string;
  pppoeUser?: string;
  pppoePass?: string;
}

export interface CommandResult {
  output: string;
  success: boolean;
  errorMsg?: string;
}

export interface OltProfile {
  tcontProfiles: string[];
  vlanProfiles: string[];
  onuTypes: string[];
}

/**
 * Abstract OLT Driver interface — all vendors must implement this
 */
export interface OltDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  exec(cmd: string): Promise<CommandResult>;
  execBatch(commands: string[]): Promise<string[]>;
  
  // Discovery
  getUnconfiguredOnus(): Promise<UncfgOnu[]>;
  getAllOnus(): Promise<OnuInfo[]>;
  getOnuByPort(board: string, port: string): Promise<OnuInfo[]>;
  getOnuRxPower(board: string, port: string, onuId: string): Promise<number | null>;
  
  // Provisioning
  registerOnu(params: RegisterOnuParams): Promise<string>;
  deleteOnu(board: string, port: string, onuId: string): Promise<boolean>;
  
  // Profiles
  getProfiles(): Promise<OltProfile>;
  initializeOlt(vlans: number[]): Promise<string>;
  
  // Monitoring
  getPonPortStats(): Promise<PonPortInfo[]>;
  checkAlarms(): Promise<OnuAlarmInfo[]>;
}

// Signal quality thresholds (dBm)
export const SIGNAL_THRESHOLDS = {
  EXCELLENT: -20,   // > -20 dBm = excellent
  GOOD: -24,        // > -24 dBm = good  
  FAIR: -27,        // > -27 dBm = fair
  POOR: -30,        // > -30 dBm = poor/weak
  CRITICAL: -35,    // < -30 dBm = critical
} as const;

export function getSignalQuality(rxPower: number | null): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'unknown' {
  if (rxPower === null) return 'unknown';
  if (rxPower > SIGNAL_THRESHOLDS.EXCELLENT) return 'excellent';
  if (rxPower > SIGNAL_THRESHOLDS.GOOD) return 'good';
  if (rxPower > SIGNAL_THRESHOLDS.FAIR) return 'fair';
  if (rxPower > SIGNAL_THRESHOLDS.POOR) return 'poor';
  return 'critical';
}

export function getSignalColor(quality: ReturnType<typeof getSignalQuality>): string {
  const colors = {
    excellent: '#10b981', // emerald-500
    good: '#3b82f6',      // blue-500
    fair: '#f59e0b',      // amber-500
    poor: '#ef4444',      // red-500
    critical: '#dc2626',  // red-600
    unknown: '#6b7280',   // gray-500
  };
  return colors[quality];
}
