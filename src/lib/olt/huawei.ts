/**
 * Huawei OLT Driver — MA5600/MA5800 Series
 * Supports SSH and Telnet connections
 */

import { Client } from 'ssh2';
const { Telnet } = require('telnet-client');

import type {
  OltDriver, OltConnStr, OnuInfo, UncfgOnu, CommandResult,
  RegisterOnuParams, OltProfile, PonPortInfo, OnuAlarmInfo,
} from './types';
import { SIGNAL_THRESHOLDS } from './types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
const sanitize = (s?: string) => (s || '').replace(/[\r\n&|;`$]/g, '').trim();

export class HuaweiDriver implements OltDriver {
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
        loginPrompt: /User name:/i,
        passwordPrompt: /Password:/i,
        username: this.connStr.username,
        password: this.connStr.password,
        timeout: this.connStr.readyTimeout || 12000,
        negotiationMandatory: false,
      });
    } else {
      return new Promise((resolve, reject) => {
        this.client = new Client();
        const timeoutId = setTimeout(() =>
          reject(new Error(`SSH timeout to ${this.connStr.host}`)), 12000);

        this.client
          .on('ready', () => {
            this.client.shell((err: any, stream: any) => {
              if (err) { clearTimeout(timeoutId); return reject(err); }
              this.sshStream = stream;
              let init = '';
              const onData = (data: Buffer) => {
                init += data.toString();
                if (init.match(/[>#]\s*$/m)) {
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
            readyTimeout: 12000,
            algorithms: {
              kex: ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group-exchange-sha256'],
              cipher: ['aes128-cbc', 'aes256-cbc', '3des-cbc', 'aes128-ctr', 'aes256-ctr'],
              serverHostKey: ['ssh-rsa', 'ssh-dss'],
              hmac: ['hmac-sha1', 'hmac-md5', 'hmac-sha2-256'],
            },
          });
      });
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isTelnet && this.client) await this.client.end();
      else if (this.client) {
        if (this.sshStream) this.sshStream.write('quit\n');
        this.client.end();
      }
    } catch { /* ignore */ }
  }

  private async execSingle(cmd: string, timeoutMs = 20000): Promise<string> {
    if (this.isTelnet) return await this.client.send(cmd);
    return new Promise((resolve, reject) => {
      let output = '';
      const timeoutId = setTimeout(() => {
        this.sshStream.removeListener('data', onData);
        reject(new Error(`Timeout: ${cmd}`));
      }, timeoutMs);

      const onData = (data: Buffer) => {
        output += data.toString();
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

  async exec(cmd: string): Promise<CommandResult> {
    try {
      const output = await this.execSingle(cmd);
      const isError = output.includes('Error:') || output.includes('Failure');
      return { output, success: !isError };
    } catch (err: any) {
      return { output: '', success: false, errorMsg: err.message };
    }
  }

  async execBatch(commands: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const cmd of commands) {
      const r = await this.exec(cmd);
      results.push(r.output);
    }
    return results;
  }

  async getUnconfiguredOnus(): Promise<UncfgOnu[]> {
    // Huawei: display ont autofind all
    await this.exec('scroll 512');
    const result = await this.exec('display ont autofind all');
    const lines = result.output.split('\n');
    const uncfgs: UncfgOnu[] = [];

    // Pattern: F/S/P  OntSN  Password  VendorID  OnuType
    for (const line of lines) {
      const match = line.match(/(\d+)\/(\d+)\/(\d+)\s+([A-F0-9]{16})\s+/i);
      if (match) {
        uncfgs.push({
          board: `${match[1]}/${match[2]}`,
          port: match[3],
          sn: match[4],
          state: 'unregistered',
        });
      }
    }
    return uncfgs;
  }

  async getAllOnus(): Promise<OnuInfo[]> {
    await this.exec('scroll 512');
    const result = await this.exec('display ont info all');
    return this.parseHuaweiOnuInfo(result.output);
  }

  async getOnuByPort(board: string, port: string): Promise<OnuInfo[]> {
    const parts = board.split('/');
    const frame = parts[0] || '0';
    const slot = parts[1] || '1';
    await this.exec('scroll 512');
    const result = await this.exec(`display ont info ${frame} ${slot} ${port} all`);
    return this.parseHuaweiOnuInfo(result.output, board, port);
  }

  private parseHuaweiOnuInfo(output: string, defaultBoard?: string, defaultPort?: string): OnuInfo[] {
    const onus: OnuInfo[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Huawei pattern: 0/1/0  0  485754433132341234  online  485754...  ...
      const match = line.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+)\s+([A-F0-9]{16})\s+(\w+)/i);
      if (match) {
        const board = `${match[1]}/${match[2]}`;
        const port = match[3];
        const onuSeq = match[4];
        const sn = match[5];
        const stateRaw = match[6].toLowerCase();

        let state: OnuInfo['state'] = 'unknown';
        if (stateRaw === 'online') state = 'working';
        else if (stateRaw === 'offline') state = 'offline';
        else if (stateRaw === 'los' || stateRaw === 'dyinggasp') state = 'los';

        onus.push({
          onuId: `${board}/${port}/${onuSeq}`,
          sn,
          board,
          port,
          state,
          rxPower: null,
          txPower: null,
          distance: null,
          vendor: 'Huawei',
        });
      }
    }
    return onus;
  }

  async getOnuRxPower(board: string, port: string, onuId: string): Promise<number | null> {
    const parts = board.split('/');
    const frame = parts[0] || '0';
    const slot = parts[1] || '1';
    const result = await this.exec(`display ont optical-info ${frame} ${slot} ${port} ${onuId}`);
    const match = result.output.match(/Rx optical power\s*[:(]\s*([-\d.]+)/i);
    return match ? parseFloat(match[1]) : null;
  }

  async getProfiles(): Promise<OltProfile> {
    const [dba, srv] = await Promise.all([
      this.exec('display dba-profile all'),
      this.exec('display service-port all'),
    ]);
    
    const tcontProfiles = new Set<string>();
    const vlanProfiles = new Set<string>();
    
    for (const line of dba.output.split('\n')) {
      const m = line.match(/Profile-ID\s+(\d+)\s+Profile-name\s+([\w-]+)/i);
      if (m) tcontProfiles.add(`${m[2]}(${m[1]})`);
    }

    return {
      tcontProfiles: Array.from(tcontProfiles),
      vlanProfiles: Array.from(vlanProfiles),
      onuTypes: ['HG8546M', 'HG8145V5', 'HG8546V', 'EG8145V5', 'HG8245Q'],
    };
  }

  async registerOnu(params: RegisterOnuParams): Promise<string> {
    const parts = params.board.split('/');
    const frame = parts[0] || '0';
    const slot = parts[1] || '1';
    const port = params.port;

    // Find next ONU ID
    const stateResult = await this.exec(`display ont info ${frame} ${slot} ${port} all`);
    const usedIds = new Set<number>();
    for (const line of stateResult.output.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+[A-F0-9]{16}/i);
      if (m) usedIds.add(parseInt(m[1]));
    }
    let freeId = 0;
    while (usedIds.has(freeId)) freeId++;

    const safeSn = sanitize(params.sn);
    const safeDesc = sanitize(params.name).replace(/ /g, '_');
    const dbaProfile = '1'; // default DBA profile ID

    const cmds = [
      'config',
      `interface gpon ${frame}/${slot}`,
      `ont add ${port} ${freeId} sn-auth "${safeSn}" omci ont-lineprofile-id 10 ont-srvprofile-id 10 desc ${safeDesc}`,
      'quit',
      `service-port vlan ${params.vlan} gpon ${frame}/${slot}/${port} ont ${freeId} gemport 1 multi-service user-vlan ${params.vlan}`,
      'quit',
    ];

    await this.execBatch(cmds);
    return `Huawei ONU registered: ONT-ID ${freeId} on ${frame}/${slot}/${port}`;
  }

  async deleteOnu(board: string, port: string, onuId: string): Promise<boolean> {
    const parts = board.split('/');
    const frame = parts[0] || '0';
    const slot = parts[1] || '1';
    const cmds = [
      'config',
      `interface gpon ${frame}/${slot}`,
      `ont delete ${port} ${onuId}`,
      'quit', 'quit',
    ];
    const results = await this.execBatch(cmds);
    return !results.some(r => r.includes('Error:'));
  }

  async initializeOlt(vlans: number[]): Promise<string> {
    const uniqueVlans = [...new Set(vlans)].filter(v => v > 0 && v <= 4094);
    const cmds: string[] = ['config'];
    for (const vlan of uniqueVlans) {
      cmds.push(`vlan ${vlan} smart`);
    }
    cmds.push('quit');
    await this.execBatch(cmds);
    return `Huawei OLT: ${uniqueVlans.length} VLANs configured`;
  }

  async getPonPortStats(): Promise<PonPortInfo[]> {
    const onus = await this.getAllOnus();
    const portMap: Map<string, PonPortInfo> = new Map();

    for (const onu of onus) {
      const key = `${onu.board}/${onu.port}`;
      if (!portMap.has(key)) {
        portMap.set(key, {
          board: onu.board, port: onu.port,
          totalOnus: 0, activeOnus: 0, offlineOnus: 0, losOnus: 0,
          capacity: 128, utilization: 0,
        });
      }
      const p = portMap.get(key)!;
      p.totalOnus++;
      if (onu.state === 'working') p.activeOnus++;
      else if (onu.state === 'los') p.losOnus++;
      else p.offlineOnus++;
    }

    for (const port of portMap.values()) {
      port.utilization = Math.round((port.totalOnus / port.capacity) * 100);
    }

    return Array.from(portMap.values());
  }

  async checkAlarms(): Promise<OnuAlarmInfo[]> {
    const onus = await this.getAllOnus();
    return onus
      .filter(o => o.state !== 'working' && o.state !== 'unknown')
      .map(o => ({
        onuId: o.onuId,
        sn: o.sn,
        board: o.board,
        port: o.port,
        alarmType: o.state === 'los' ? 'LOS' : 'OFFLINE' as any,
        rxPower: o.rxPower,
        description: `Huawei ONU ${o.sn} — ${o.state.toUpperCase()}`,
      }));
  }
}
