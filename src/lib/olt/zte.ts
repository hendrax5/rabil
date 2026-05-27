/**
 * ZTE OLT Driver — Full Implementation
 * Supports SSH and Telnet connections to ZTE C300/C320/C600/C650 series
 */

import { Client } from 'ssh2';
const { Telnet } = require('telnet-client');

import type {
  OltDriver, OltConnStr, OnuInfo, UncfgOnu, CommandResult,
  RegisterOnuParams, OltProfile, PonPortInfo, OnuAlarmInfo,
} from './types';
import { SIGNAL_THRESHOLDS } from './types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const sanitizeInput = (input?: string): string => {
  if (!input) return '';
  return input.replace(/[\r\n&|;`$]/g, '').trim();
};

export class ZTEDriver implements OltDriver {
  private connStr: OltConnStr;
  private client: any;
  private isTelnet: boolean;
  private sshStream: any = null;

  constructor(connStr: OltConnStr) {
    this.connStr = connStr;
    this.isTelnet = connStr.protocol === 'telnet';
  }

  async connect(): Promise<void> {
    if (this.isTelnet) {
      this.client = new Telnet();
      await this.client.connect({
        host: this.connStr.host,
        port: this.connStr.port || 23,
        shellPrompt: /.*[>#]\s?$/,
        loginPrompt: /Username:/i,
        passwordPrompt: /Password:/i,
        username: this.connStr.username,
        password: this.connStr.password,
        timeout: this.connStr.readyTimeout || 12000,
        execTimeout: 15000,
        sendTimeout: 3000,
        negotiationMandatory: false,
      });
    } else {
      return new Promise((resolve, reject) => {
        this.client = new Client();
        const timeoutId = setTimeout(() => {
          reject(new Error(`SSH connection timeout to ${this.connStr.host}`));
        }, this.connStr.readyTimeout || 12000);

        this.client
          .on('ready', () => {
            this.client.shell((err: any, stream: any) => {
              if (err) { clearTimeout(timeoutId); return reject(err); }
              this.sshStream = stream;
              let initOutput = '';
              const onData = (data: Buffer) => {
                initOutput += data.toString();
                if (initOutput.match(/[>#]\s?$/m)) {
                  clearTimeout(timeoutId);
                  this.sshStream.removeListener('data', onData);
                  resolve();
                }
              };
              this.sshStream.on('data', onData);
            });
          })
          .on('error', (err: any) => { clearTimeout(timeoutId); reject(err); })
          .connect({
            host: this.connStr.host,
            port: this.connStr.port || 22,
            username: this.connStr.username,
            password: this.connStr.password,
            readyTimeout: this.connStr.readyTimeout || 12000,
            algorithms: {
              kex: [
                'diffie-hellman-group1-sha1',
                'diffie-hellman-group14-sha1',
                'diffie-hellman-group14-sha256',
                'diffie-hellman-group-exchange-sha256',
                'ecdh-sha2-nistp256',
                'curve25519-sha256',
              ],
              cipher: [
                'aes128-cbc', 'aes256-cbc', '3des-cbc',
                'aes128-ctr', 'aes256-ctr', 'aes192-ctr',
              ],
              serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256'],
              hmac: ['hmac-sha1', 'hmac-md5', 'hmac-sha2-256'],
            },
          });
      });
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isTelnet && this.client) {
        await this.client.end();
      } else if (this.client) {
        if (this.sshStream) this.sshStream.write('exit\n');
        this.client.end();
      }
    } catch {
      // ignore disconnect errors
    }
  }

  private async execSingle(cmd: string, timeoutMs = 20000): Promise<string> {
    if (this.isTelnet) {
      return await this.client.send(cmd);
    } else {
      return new Promise((resolve, reject) => {
        let output = '';
        const timeoutId = setTimeout(() => {
          this.sshStream.removeListener('data', onData);
          reject(new Error(`Command timeout (${timeoutMs}ms): ${cmd}`));
        }, timeoutMs);

        const onData = (data: Buffer) => {
          output += data.toString();
          // ZTE prompts end with # or > 
          if (output.match(/[>#]\s*$/m) && output.length > cmd.length + 2) {
            clearTimeout(timeoutId);
            this.sshStream.removeListener('data', onData);
            resolve(output);
          }
        };
        this.sshStream.on('data', onData);
        this.sshStream.write(cmd + '\n');
      });
    }
  }

  async exec(cmd: string): Promise<CommandResult> {
    try {
      const output = await this.execSingle(cmd);
      const isError = output.includes('%Error') || output.includes('%Code');
      return { output, success: !isError, errorMsg: isError ? 'CLI error' : undefined };
    } catch (err: any) {
      return { output: '', success: false, errorMsg: err.message };
    }
  }

  async execBatch(commands: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const cmd of commands) {
      const r = await this.exec(cmd);
      results.push(r.output);
      if (!r.success && !cmd.includes('terminal length')) {
        // non-fatal: continue
      }
    }
    return results;
  }

  async getUnconfiguredOnus(): Promise<UncfgOnu[]> {
    await this.exec('terminal length 0');
    const result = await this.exec('show gpon onu uncfg');
    const lines = result.output.split('\n');
    const uncfgs: UncfgOnu[] = [];

    for (const line of lines) {
      // Pattern: gpon-onu_1/1/1:  ZTEGABCD1234  los  1.ZTE-Home  Llid:X
      const match = line.match(/gpon-onu_(\d+\/\d+)\/(\d+):\s+([A-Z0-9]+)\s+(\S+)(?:\s+(\S+))?(?:\s+Llid:(\d+))?/i);
      if (match) {
        uncfgs.push({
          board: match[1],
          port: match[2],
          sn: match[3],
          state: match[4],
          type: match[5],
          llid: match[6],
        });
      }
    }
    return uncfgs;
  }

  async getAllOnus(): Promise<OnuInfo[]> {
    await this.exec('terminal length 0');
    
    // Get all ONU states across all ports
    const stateResult = await this.exec('show gpon onu state');
    const rxResult = await this.exec('show gpon remote-onu optical-info');
    
    return this.parseOnuStates(stateResult.output, rxResult.output);
  }

  async getOnuByPort(board: string, port: string): Promise<OnuInfo[]> {
    await this.exec('terminal length 0');
    const stateResult = await this.exec(`show gpon onu state gpon-olt_${board}/${port}`);
    const rxResult = await this.exec(`show gpon remote-onu optical-info gpon-olt_${board}/${port}`);
    return this.parseOnuStates(stateResult.output, rxResult.output);
  }

  private parseOnuStates(stateOutput: string, rxOutput: string): OnuInfo[] {
    const onus: OnuInfo[] = [];
    
    // Build rx power map
    const rxMap: Map<string, number> = new Map();
    for (const line of rxOutput.split('\n')) {
      // gpon-onu_1/1/1:1   -24.50  -3.10  ...
      const rxMatch = line.match(/gpon-onu_(\d+\/\d+\/\d+:\d+)\s+([-\d.]+)/);
      if (rxMatch) {
        rxMap.set(rxMatch[1], parseFloat(rxMatch[2]));
      }
    }

    // Parse state table
    for (const line of stateOutput.split('\n')) {
      // gpon-onu_1/1/1:1   ZTEGABCD1234   working   10/10
      const match = line.match(/gpon-onu_(\d+\/\d+)\/(\d+):(\d+)\s+([A-Z0-9]+)\s+(\w+)/i);
      if (match) {
        const board = match[1];
        const port = match[2];
        const onuSeq = match[3];
        const sn = match[4];
        const stateRaw = match[5].toLowerCase();
        const onuId = `${board}/${port}:${onuSeq}`;
        const fullId = `gpon-onu_${onuId}`;
        
        const rxPower = rxMap.get(fullId) ?? null;
        
        let state: OnuInfo['state'] = 'unknown';
        if (stateRaw === 'working') {
          state = rxPower !== null && rxPower < SIGNAL_THRESHOLDS.POOR ? 'degraded' : 'working';
        } else if (stateRaw === 'los') {
          state = 'los';
        } else if (stateRaw === 'offline' || stateRaw === 'dormant') {
          state = 'offline';
        }

        onus.push({
          onuId,
          sn,
          board,
          port,
          state,
          rxPower,
          txPower: null,
          distance: null,
          vendor: 'ZTE',
        });
      }
    }

    return onus;
  }

  async getOnuRxPower(board: string, port: string, onuId: string): Promise<number | null> {
    const result = await this.exec(`show gpon remote-onu optical-info gpon-onu_${board}/${port}:${onuId}`);
    const match = result.output.match(/Rx power\s*[:=]\s*([-\d.]+)/i) 
      || result.output.match(/([-\d.]+)\s+dBm/i);
    return match ? parseFloat(match[1]) : null;
  }

  async getProfiles(): Promise<OltProfile> {
    await this.exec('terminal length 0');
    const [tcont, vlan, types] = await Promise.all([
      this.exec('show running-config | include "profile tcont"'),
      this.exec('show running-config | include "vlan-profile"'),
      this.exec('show pon onu-type gpon'),
    ]);

    const tcontProfiles = new Set<string>();
    const vlanProfiles = new Set<string>();
    const onuTypes = new Set<string>();

    for (const line of tcont.output.split('\n')) {
      const m = line.match(/profile\s+tcont\s+([a-zA-Z0-9.\-_]+)/i);
      if (m) tcontProfiles.add(m[1]);
    }
    for (const line of vlan.output.split('\n')) {
      const m = line.match(/vlan-profile\s+([a-zA-Z0-9.\-_]+)/i);
      if (m) vlanProfiles.add(m[1]);
    }
    for (const line of types.output.split('\n')) {
      const m = line.match(/^([a-zA-Z0-9.\-_]+)\s+GPON/i);
      if (m) onuTypes.add(m[1]);
    }

    return {
      tcontProfiles: Array.from(tcontProfiles),
      vlanProfiles: Array.from(vlanProfiles),
      onuTypes: Array.from(onuTypes).slice(0, 20),
    };
  }

  async registerOnu(params: RegisterOnuParams): Promise<string> {
    // Find lowest available ONU ID
    const stateResult = await this.exec(`show gpon onu state gpon-olt_${params.board}/${params.port}`);
    const usedIds = new Set<number>();
    for (const line of stateResult.output.split('\n')) {
      const match = line.match(new RegExp(`(?:gpon-onu_)?${params.board}\\/${params.port}:(\\d+)`, 'i'));
      if (match) usedIds.add(parseInt(match[1]));
    }
    let freeId = 1;
    while (usedIds.has(freeId)) freeId++;

    const onuType = sanitizeInput(params.onuType) || '1.ZTE-Home';
    const isPppoe = params.mode === 'pppoe';
    const safeName = sanitizeInput(params.name).replace(/ /g, '_') || `ONU_${params.sn.slice(-4)}`;
    const safeVlanProfile = sanitizeInput(params.vlanProfile);
    const safePppoeUser = sanitizeInput(params.pppoeUser) || safeName;
    const safePppoePass = sanitizeInput(params.pppoePass) || 'password123';

    let cmds: string[];

    if (isPppoe) {
      cmds = [
        'conf t',
        `interface gpon-olt_${params.board}/${params.port}`,
        `onu ${freeId} type ${onuType} sn ${params.sn}`,
        'exit',
        `interface gpon-onu_${params.board}/${params.port}:${freeId}`,
        `name ${safeName}`,
        `description internet client`,
        `tcont 1 profile UNLIMITED`,
        `gemport 1 name Internet tcont 1`,
        `service-port 1 vport 1 user-vlan ${params.vlan} vlan ${params.vlan}`,
        `port-identification format DSL-FORUM-PON vport 1`,
        `pppoe-intermediate-agent enable vport 1`,
        'exit',
        `pon-onu-mng gpon-onu_${params.board}/${params.port}:${freeId}`,
        `service Internet gemport 1 vlan ${params.vlan}`,
        `wan-ip 1 mode pppoe username ${safePppoeUser} password ${safePppoePass} vlan-profile ${safeVlanProfile || `vlan${params.vlan}`} host 1`,
        ...(params.vlanAcs ? [
          `service TR069 gemport 1 vlan ${params.vlanAcs}`,
          `wan-ip 2 mode dhcp vlan-profile vlan${params.vlanAcs} host 2`,
          ...(params.acsUrl ? [
            `tr069-mgmt 1 server-url ${sanitizeInput(params.acsUrl)}`,
            ...(params.acsUser && params.acsPass ? [`tr069-mgmt 1 pppoe-user ${sanitizeInput(params.acsUser)} password ${sanitizeInput(params.acsPass)}`] : []),
            'tr069-mgmt 1 tr069-enable enable',
          ] : []),
        ] : []),
        `security-mgmt 212 state enable mode forward protocol web`,
        'end',
      ];
    } else {
      cmds = [
        'conf t',
        `interface gpon-olt_${params.board}/${params.port}`,
        `onu ${freeId} type ${onuType} sn ${params.sn}`,
        'exit',
        `interface gpon-onu_${params.board}/${params.port}:${freeId}`,
        `name ${safeName}`,
        `tcont 1 name T1 profile UNLIMITED`,
        `gemport 1 name HSI tcont 1`,
        'exit',
        `pon-onu-mng gpon-onu_${params.board}/${params.port}:${freeId}`,
        `service HSI gemport 1 vlan ${params.vlan}`,
        `vlan port eth_0/1 mode tag vlan ${params.vlan}`,
        ...(params.vlanAcs ? [
          `service TR069 gemport 1 vlan ${params.vlanAcs}`,
          `wan-ip 2 mode dhcp vlan-profile vlan${params.vlanAcs} host 2`,
        ] : []),
        'end',
      ];
    }

    const results = await this.execBatch(cmds);
    return `ONU registered with ID ${freeId} on port ${params.board}/${params.port}`;
  }

  async deleteOnu(board: string, port: string, onuId: string): Promise<boolean> {
    const cmds = [
      'conf t',
      `interface gpon-olt_${board}/${port}`,
      `no onu ${onuId}`,
      'end',
    ];
    const results = await this.execBatch(cmds);
    return !results.some(r => r.includes('%Error'));
  }

  async initializeOlt(vlans: number[]): Promise<string> {
    const uniqueVlans = [...new Set(vlans)].filter(v => v > 0 && v <= 4094);
    const cmds: string[] = ['conf t', 'gpon', 'profile tcont UNLIMITED type 4 maximum 1024000', 'exit'];
    
    for (const vlan of uniqueVlans) {
      cmds.push(`vlan ${vlan}`, `name VLAN${vlan}`, 'exit');
    }
    cmds.push('gpon');
    for (const vlan of uniqueVlans) {
      cmds.push(`onu profile vlan vlan${vlan} tag-mode tag cvlan ${vlan}`);
    }
    cmds.push('exit', 'end');

    await this.execBatch(cmds);
    return `OLT initialized: UNLIMITED profile + ${uniqueVlans.length} VLANs`;
  }

  async getPonPortStats(): Promise<PonPortInfo[]> {
    const onus = await this.getAllOnus();
    const portMap: Map<string, PonPortInfo> = new Map();

    for (const onu of onus) {
      const key = `${onu.board}/${onu.port}`;
      if (!portMap.has(key)) {
        portMap.set(key, {
          board: onu.board,
          port: onu.port,
          totalOnus: 0,
          activeOnus: 0,
          offlineOnus: 0,
          losOnus: 0,
          capacity: 128,
          utilization: 0,
        });
      }
      const portInfo = portMap.get(key)!;
      portInfo.totalOnus++;
      if (onu.state === 'working') portInfo.activeOnus++;
      else if (onu.state === 'los') portInfo.losOnus++;
      else portInfo.offlineOnus++;
    }

    for (const port of portMap.values()) {
      port.utilization = Math.round((port.totalOnus / port.capacity) * 100);
    }

    return Array.from(portMap.values()).sort((a, b) => {
      const ak = `${a.board}/${a.port}`;
      const bk = `${b.board}/${b.port}`;
      return ak.localeCompare(bk);
    });
  }

  async checkAlarms(): Promise<OnuAlarmInfo[]> {
    const onus = await this.getAllOnus();
    const alarms: OnuAlarmInfo[] = [];

    for (const onu of onus) {
      if (onu.state === 'los') {
        alarms.push({
          onuId: onu.onuId,
          sn: onu.sn,
          board: onu.board,
          port: onu.port,
          alarmType: 'LOS',
          rxPower: onu.rxPower,
          threshold: SIGNAL_THRESHOLDS.POOR,
          description: `ONU ${onu.sn} — Loss of Signal on port ${onu.board}/${onu.port}`,
        });
      } else if (onu.state === 'offline') {
        alarms.push({
          onuId: onu.onuId,
          sn: onu.sn,
          board: onu.board,
          port: onu.port,
          alarmType: 'OFFLINE',
          rxPower: onu.rxPower,
          description: `ONU ${onu.sn} — Offline on port ${onu.board}/${onu.port}`,
        });
      } else if (onu.state === 'degraded') {
        alarms.push({
          onuId: onu.onuId,
          sn: onu.sn,
          board: onu.board,
          port: onu.port,
          alarmType: 'WEAK_SIGNAL',
          rxPower: onu.rxPower,
          threshold: SIGNAL_THRESHOLDS.POOR,
          description: `ONU ${onu.sn} — Weak signal ${onu.rxPower} dBm (threshold: ${SIGNAL_THRESHOLDS.POOR} dBm)`,
        });
      }
    }

    return alarms;
  }
}
