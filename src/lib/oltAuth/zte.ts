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

const execInteractiveSsh = (client: Client, commands: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    client.shell((err, stream) => {
      if (err) return reject(err);
      
      let output = '';
      let cmdIndex = 0;
      
      stream.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        
        // When we see the prompt string send the next command
        if (text.endsWith('# ') || text.endsWith('> ') || text.endsWith('#')) {
          if (cmdIndex < commands.length) {
            stream.write(commands[cmdIndex] + '\n');
            cmdIndex++;
          } else {
            stream.write('exit\n'); // close shell
          }
        }
      });
      
      stream.on('close', () => resolve(output));
    });
  });
};

const executeZteCommands = async (connStr: OltConnStr, commands: string[]): Promise<string> => {
  if (connStr.protocol === 'telnet') {
    const connection = new Telnet();
    const params = {
      host: connStr.host,
      port: connStr.port,
      shellPrompt: /.*[>#]\s?$/,
      loginPrompt: /Username:/i,
      passwordPrompt: /Password:/i,
      username: connStr.username,
      password: connStr.password,
      timeout: 10000
    };

    await connection.connect(params);
    let output = '';
    for (const cmd of commands) {
      const res = await connection.send(cmd);
      output += res + '\n';
    }
    connection.end();
    return output;
  } else {
    // SSH
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', async () => {
        try {
          const output = await execInteractiveSsh(conn, commands);
          conn.end();
          resolve(output);
        } catch (e) {
          conn.end();
          reject(e);
        }
      }).on('error', (err) => {
        reject(err);
      }).connect({
        host: connStr.host,
        port: connStr.port,
        username: connStr.username,
        password: connStr.password,
        readyTimeout: 10000
      });
    });
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

export interface RegisterOnuParams {
  board: string;
  port: string;
  sn: string;
  name: string;
  vlan: string;
  mode?: 'bridge' | 'pppoe';
  onuType?: string;
  profile?: string;
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
  let cmds: string[] = [];

  if (isPppoe) {
    const profile = params.profile || 'UP';
    const serviceName = 'Internet';
    
    cmds = [
      'conf t',
      `interface gpon-olt_${params.board}/${params.port}`,
      `onu ${freeId} type ${onuType} sn ${params.sn}`,
      'exit',
      `interface gpon-onu_${params.board}/${params.port}:${freeId}`,
      `name ${params.name.replace(/ /g, '_')}`,
      `description internet client`,
      `tcont 1 name ${serviceName} profile ${profile}`,
      `gemport 1 name ${serviceName} tcont 1`,
      `service-port 1 vport 1 user-vlan ${params.vlan} vlan ${params.vlan}`,
      `service-port 1 description ${serviceName} tcont 1`,
      `port-identification format DSL-FORUM-PON vport 1`,
      `pppoe-intermediate-agent enable vport 1`,
      'exit',
      `pon-onu-mng gpon-onu_${params.board}/${params.port}:${freeId}`,
      `service ${serviceName} gemport 1 vlan ${params.vlan}`,
      `wan-ip 1 mode pppoe username ${params.pppoeUser || params.name} password ${params.pppoePass || '123456'} vlan-profile ${serviceName} host 1`,
      `security-mgmt 212 state enable mode forward protocol web`,
      'end'
    ];
  } else {
    cmds = [
      'conf t',
      'gpon',
      'profile tcont NEXA_UP type 4 maximum 1024000',
      'exit',
      `interface gpon-olt_${params.board}/${params.port}`,
      `onu ${freeId} type ${onuType} sn ${params.sn}`,
      'exit',
      `interface gpon-onu_${params.board}/${params.port}:${freeId}`,
      `name ${params.name.replace(/ /g, '_')}`,
      `tcont 1 name T1 profile NEXA_UP`,
      `gemport 1 name HSI tcont 1`,
      'exit',
      `pon-onu-mng gpon-onu_${params.board}/${params.port}:${freeId}`,
      `service HSI gemport 1 vlan ${params.vlan}`,
      `vlan port eth_0/1 mode tag vlan ${params.vlan}`,
      'end'
    ];
  }

  const output = await executeZteCommands(connStr, cmds);
  return `Registered ONU with ID ${freeId}.\n` + output;
};
