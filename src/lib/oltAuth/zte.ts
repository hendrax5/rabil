import { Client } from 'ssh2';
const { Telnet } = require('telnet-client');

export interface UncfgOnu {
  board: string;
  port: string;
  sn: string;
  state: string;
}

interface OltConnStr {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: string; // 'ssh' or 'telnet'
}

export interface OltCommandOptions {
  cmd: string;
  ignoreError?: boolean;
  retries?: number;
}

export interface ZteCommandResult {
  output: string;
  success: boolean;
  errorMsg?: string;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class ZteEngine {
  private connStr: OltConnStr;
  private client: any;
  private isTelnet: boolean;
  private sshStream: any = null;
  private maxRetries: number = 3;

  constructor(connStr: OltConnStr) {
    this.connStr = connStr;
    this.isTelnet = connStr.protocol === 'telnet';
  }

  async connect(): Promise<void> {
    if (this.isTelnet) {
      this.client = new Telnet();
      const params = {
        host: this.connStr.host,
        port: this.connStr.port || 23,
        shellPrompt: /.*[>#]\s?$/,
        loginPrompt: /Username:/i,
        passwordPrompt: /Password:/i,
        username: this.connStr.username,
        password: this.connStr.password,
        timeout: 10000
      };
      await this.client.connect(params);
    } else {
      return new Promise((resolve, reject) => {
        this.client = new Client();
        this.client.on('ready', () => {
          this.client.shell((err: any, stream: any) => {
            if (err) return reject(err);
            this.sshStream = stream;
            // Wait for initial prompt before resolving
            let initialOutput = '';
            const onData = (data: Buffer) => {
              initialOutput += data.toString();
              if (initialOutput.match(/.*[>#]\s?$/)) {
                this.sshStream.removeListener('data', onData);
                resolve();
              }
            };
            this.sshStream.on('data', onData);
            this.sshStream.on('close', () => { /* connection closed */ });
          });
        }).on('error', (err: any) => {
          reject(err);
        }).connect({
          host: this.connStr.host,
          port: this.connStr.port || 22,
          username: this.connStr.username,
          password: this.connStr.password,
          readyTimeout: 10000
        });
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.isTelnet && this.client) {
      await this.client.end();
    } else if (this.client) {
      if (this.sshStream) {
        this.sshStream.write('exit\n');
      }
      this.client.end();
    }
  }

  private async execSingle(cmd: string): Promise<string> {
    if (this.isTelnet) {
      return await this.client.send(cmd);
    } else {
      return new Promise((resolve, reject) => {
        let output = '';
        
        // Timeout for single command execution to avoid hanging forever
        const timeoutId = setTimeout(() => {
          this.sshStream.removeListener('data', onData);
          reject(new Error(`Command timeout: ${cmd}`));
        }, 15000);

        const onData = (data: Buffer) => {
          output += data.toString();
          if (output.match(/.*[>#]\s?$/)) {
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

  async exec(command: string | OltCommandOptions): Promise<ZteCommandResult> {
    const opts: OltCommandOptions = typeof command === 'string' ? { cmd: command } : command;
    const maxAttempt = opts.retries !== undefined ? opts.retries : this.maxRetries;
    const ignoreError = opts.ignoreError || false;

    for (let attempt = 1; attempt <= maxAttempt; attempt++) {
      try {
        console.log(`[ZteEngine] [${this.connStr.host}] Executing: ${opts.cmd} (Attempt ${attempt}/${maxAttempt})`);
        const output = await this.execSingle(opts.cmd);

        // Parse for %Error or %Code
        const isError = output.includes('%Error') || output.includes('%Code');
        if (isError) {
          console.error(`[ZteEngine] [${this.connStr.host}] CLI Error on: ${opts.cmd}\n${output}`);
          // CLI syntax error should usually not be retried because it's a structural error
          if (ignoreError) {
            return { output, success: false, errorMsg: 'CLI syntax error ignored.' };
          }
          throw new Error(`CLI Error executing '${opts.cmd}':\n${output}`);
        }

        return { output, success: true };
      } catch (err: any) {
        console.warn(`[ZteEngine] [${this.connStr.host}] Warning on: ${opts.cmd} - ${err.message}`);
        if (attempt === maxAttempt) {
          console.error(`[ZteEngine] [${this.connStr.host}] Failed after ${maxAttempt} attempts: ${opts.cmd}`);
          if (ignoreError) {
            return { output: err.message, success: false, errorMsg: err.message };
          }
          throw new Error(`Command failed after ${maxAttempt} attempts: ${opts.cmd} (${err.message})`);
        }
        // Exponential backoff: 2s, 4s, etc.
        await delay(attempt * 2000); 
      }
    }
    return { output: '', success: false };
  }

  async execBatch(commands: (string | OltCommandOptions)[], strict = true): Promise<string[]> {
    const results: string[] = [];
    for (const cmd of commands) {
      // In strict mode, if exec throws, it will abort the batch
      const res = await this.exec(typeof cmd === 'string' ? { cmd, ignoreError: !strict } : cmd);
      results.push(res.output);
    }
    return results;
  }
}

const executeZteCommands = async (connStr: OltConnStr, commands: string[]): Promise<string> => {
  const engine = new ZteEngine(connStr);
  try {
    await engine.connect();
    const results = await engine.execBatch(commands, true); // Strict mode
    return results.join('\n');
  } finally {
    await engine.disconnect();
  }
};

export const getZteUncfgOnu = async (connStr: OltConnStr): Promise<UncfgOnu[]> => {
  try {
    const output = await executeZteCommands(connStr, ['terminal length 0', 'show gpon onu uncfg']);
    const lines = output.split('\n');
    const uncfgs: UncfgOnu[] = [];
    for (const line of lines) {
      const match = line.match(/gpon-onu_(\d+)\/(\d+)\/(\d+):[^\s]+\s+([A-Z0-9]+)\s+([a-z]+)/i);
      if (match) {
        uncfgs.push({
          board: match[1] + '/' + match[2],
          port: match[3],
          sn: match[4],
          state: match[5]
        });
      }
    }
    return uncfgs;
  } catch (e) {
    throw e;
  }
};

export const getZteOnuTypes = async (connStr: OltConnStr): Promise<string[]> => {
  try {
    const output = await executeZteCommands(connStr, ['terminal length 0', 'show pon onu-type gpon']);
    const lines = output.split('\n');
    const types = new Set<string>();
    
    // Example tabular output:
    // ONU type        Category   Type Name           Brand        Description
    // --------------------------------------------------------------------------------
    // ZTEG-F609       GPON       ZTEG-F609           ZTE          ZTEG-F609
    // 1.ZTE-Home      GPON       1.ZTE-Home                       
    for (const line of lines) {
      // Matches the first column if it's followed by GPON
      const match = line.match(/^([a-zA-Z0-9.\-_]+)\s+GPON/i);
      if (match) {
        types.add(match[1]);
      }
    }
    return Array.from(types);
  } catch (e) {
    return [];
  }
};

export const getZteProfilesList = async (connStr: OltConnStr): Promise<{ tcontProfiles: string[], vlanProfiles: string[] }> => {
  try {
    const output = await executeZteCommands(connStr, [
      'terminal length 0', 
      'show running-config | include "profile tcont"',
      'show running-config | include "vlan-profile"'
    ]);
    const lines = output.split('\n');
    const tcont = new Set<string>();
    const vlan = new Set<string>();
    
    for (const line of lines) {
      const tcontMatch = line.match(/^\s*profile\s+tcont\s+([a-zA-Z0-9.\-_]+)/i);
      if (tcontMatch) tcont.add(tcontMatch[1]);
      
      const vlanMatch = line.match(/^\s*vlan-profile\s+([a-zA-Z0-9.\-_]+)/i);
      if (vlanMatch) vlan.add(vlanMatch[1]);
    }
    
    return { tcontProfiles: Array.from(tcont), vlanProfiles: Array.from(vlan) };
  } catch (e) {
    console.error('Failed to get profiles list:', e);
    return { tcontProfiles: [], vlanProfiles: [] };
  }
};

export const initializeZteOlt = async (
  connStr: OltConnStr,
  vlans: number[],
  options?: {
    tcontName?: string;
    maxBandwidth?: number;
  }
): Promise<string> => {
  const tcontName = options?.tcontName || "UNLIMITED";
  const maxBw = options?.maxBandwidth || 1024000;

  const uniqueVlans = [...new Set(vlans)].filter(v => v > 0 && v <= 4094);

  const cmds: string[] = [];

  // ===== ENTER CONFIG =====
  cmds.push('conf t');

  // ===== GPON TCONT PROFILE =====
  cmds.push('gpon');
  cmds.push(`profile tcont ${tcontName} type 4 maximum ${maxBw}`);
  cmds.push('exit');

  // ===== VLAN GLOBAL SETUP =====
  for (const vlan of uniqueVlans) {
    cmds.push(`vlan ${vlan}`);
    cmds.push(`name VLAN${vlan}`);
    cmds.push('exit');
  }

  // ===== ONU VLAN PROFILE =====
  cmds.push('gpon');
  for (const vlan of uniqueVlans) {
    cmds.push(`onu profile vlan vlan${vlan} tag-mode tag cvlan ${vlan}`);
  }
  cmds.push('exit');

  cmds.push('end');

  try {
    const output = await executeZteCommands(connStr, cmds);

    return [
      "=== OLT INIT SUCCESS ===",
      `TCONT: ${tcontName}`,
      `VLAN COUNT: ${uniqueVlans.length}`,
      output
    ].join("\n");

  } catch (err: any) {
    return [
      "=== OLT INIT FAILED ===",
      err.message || err
    ].join("\n");
  }
};

const sanitizeInput = (input?: string): string => {
  if (!input) return '';
  // Remove all instances of newlines, carriage returns, &, |, ; to prevent command/cli injection
  return input.replace(/[\r\n&|;]/g, '').trim();
};

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

export const registerZteOnu = async (connStr: OltConnStr, params: RegisterOnuParams): Promise<string> => {
  // First find the lowest available ONU ID by parsing the state table
  const stateOutput = await executeZteCommands(connStr, [
    'terminal length 0', 
    `show gpon onu state gpon-olt_${params.board}/${params.port}`
  ]);
  const usedIds = new Set<number>();
  const lines = stateOutput.split('\n');
  console.log("=== RAW STATE OUTPUT ===\n", stateOutput, "\n=====================");
  console.log("Matching with REGEX:", `(?:gpon-onu_)?${params.board}\\/${params.port}:(\\d+)`);
  
  for (const line of lines) {
    // Matches gpon-onu_1/1/1:1 or simply 1/1/1:1
    const match = line.match(new RegExp(`(?:gpon-onu_)?${params.board}\\/${params.port}:(\\d+)`, 'i'));
    if (match) {
      usedIds.add(parseInt(match[1]));
    }
  }
  console.log("Found Used IDs:", Array.from(usedIds));
  
  let freeId = 1;
  while (usedIds.has(freeId)) {
    freeId++;
  }

  const onuType = params.onuType || '1.ZTE-Home';
  const isPppoe = params.mode === 'pppoe';
  
  // Sanitize all inputs interacting directly with the CLI
  const safeName = sanitizeInput(params.name).replace(/ /g, '_');
  const safeProfile = 'UNLIMITED'; // Force unlimited as limiter is on MikroTik
  const safeVlanProfile = sanitizeInput(params.vlanProfile);
  const safePppoeUser = sanitizeInput(params.pppoeUser) || safeName;
  const safePppoePass = sanitizeInput(params.pppoePass) || '123456';
  
  let cmds: string[] = [];

  if (isPppoe) {
    const serviceName = 'Internet';
    
    cmds = [
      'conf t',
      `interface gpon-olt_${params.board}/${params.port}`,
      `onu ${freeId} type ${onuType} sn ${params.sn}`,
      'exit',
      `interface gpon-onu_${params.board}/${params.port}:${freeId}`,
      `name ${safeName}`,
      `description internet client`,
      `tcont 1 profile ${safeProfile}`,
      `gemport 1 name ${serviceName} tcont 1`,
      `service-port 1 vport 1 user-vlan ${params.vlan} vlan ${params.vlan}`,
      `service-port 1 description ${serviceName} tcont 1`,
      `port-identification format DSL-FORUM-PON vport 1`,
      `pppoe-intermediate-agent enable vport 1`,
      'exit',
      `pon-onu-mng gpon-onu_${params.board}/${params.port}:${freeId}`,
      `service ${serviceName} gemport 1 vlan ${params.vlan}`,
      `wan-ip 1 mode pppoe username ${safePppoeUser} password ${safePppoePass} vlan-profile ${safeVlanProfile || `vlan${params.vlan}`} host 1`,
      ...(params.vlanAcs ? [
        `service TR069 gemport 1 vlan ${params.vlanAcs}`,
        `wan-ip 2 mode dhcp vlan-profile vlan${params.vlanAcs} host 2`,
        ...(params.acsUrl ? [
          `tr069-mgmt 1 server-url ${sanitizeInput(params.acsUrl)}`,
          ...(params.acsUser && params.acsPass ? [`tr069-mgmt 1 pppoe-user ${sanitizeInput(params.acsUser)} password ${sanitizeInput(params.acsPass)}`] : []),
          `tr069-mgmt 1 tr069-enable enable`
        ] : [])
      ] : []),
      `security-mgmt 212 state enable mode forward protocol web`,
      'end'
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
        ...(params.acsUrl ? [
          `tr069-mgmt 1 server-url ${sanitizeInput(params.acsUrl)}`,
          ...(params.acsUser && params.acsPass ? [`tr069-mgmt 1 pppoe-user ${sanitizeInput(params.acsUser)} password ${sanitizeInput(params.acsPass)}`] : []),
          `tr069-mgmt 1 tr069-enable enable`
        ] : [])
      ] : []),
      'end'
    ];
  }

  const output = await executeZteCommands(connStr, cmds);
  return `Registered ONU with ID ${freeId}.\n` + output;
};
