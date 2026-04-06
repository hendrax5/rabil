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
    const output = await executeZteCommands(connStr, ['show gpon onu uncfg']);
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

export const registerZteOnu = async (connStr: OltConnStr, params: { board: string, port: string, sn: string, name: string, vlan: string }): Promise<string> => {
  const cmds = [
    'conf t',
    `interface gpon-olt_${params.board}/${params.port}`,
    // Tipe generic ZTE-G biasanya universal untuk berbagai modem
    `onu bind mac ${params.sn} type ZTE-G`,
    'exit',
    // Assuming dynamic ID 1 for testing, this should parse open ports
    `interface gpon-onu_${params.board}/${params.port}:1`,
    `name ${params.name.replace(/ /g, '_')}`,
    `tcont 1 profile UP`, // TCON Unlimited, bandwidth limited via Mikrotik
    `gemport 1 name HSI tcont 1`,
    `vlan port eth_0/1 mode tag vlan ${params.vlan}`,
    'end'
  ];
  return await executeZteCommands(connStr, cmds);
};
