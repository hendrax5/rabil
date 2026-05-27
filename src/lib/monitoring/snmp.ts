import dgram from 'dgram';
import { RouterOSAPI } from 'node-routeros';
import { withOlt } from '../olt';

// SNMP OIDs
const OIDS = {
  // MikroTik OIDs
  mikrotikCpu: '1.3.6.1.4.1.14988.1.1.3.10.0',
  mikrotikTotalMemory: '1.3.6.1.2.1.25.2.3.1.5.65536',
  mikrotikFreeMemory: '1.3.6.1.2.1.25.2.3.1.6.65536',
  
  // Generic OIDs
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysDescr: '1.3.6.1.2.1.1.1.0',
};

interface DeviceStats {
  cpuUsage: number | null;
  memoryUsage: number | null;
}

/**
 * Encodes an OID string (e.g. "1.3.6.1.2.1.1.3.0") into ASN.1 BER encoding bytes
 */
function encodeOid(oidStr: string): Buffer {
  const parts = oidStr.split('.').map(Number);
  const encoded = [];
  
  // First two parts are encoded as: part1 * 40 + part2
  encoded.push(parts[0] * 40 + parts[1]);
  
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val === 0) {
      encoded.push(0);
    } else {
      const bytes = [];
      while (val > 0) {
        bytes.push((val & 0x7f) | 0x80);
        val = val >> 7;
      }
      bytes[0] = bytes[0] & 0x7f; // Clear continuation bit for the last byte
      encoded.push(...bytes.reverse());
    }
  }
  return Buffer.from(encoded);
}

/**
 * Simple pure-JS SNMP v2c GET packet builder
 */
function buildSnmpGetPacket(community: string, oid: string, requestId = 1): Buffer {
  const oidBuf = encodeOid(oid);
  
  // 1. Build Varbind (OID + Null value)
  const varbind = Buffer.concat([
    Buffer.from([0x06, oidBuf.length]), // OID Tag & Length
    oidBuf,
    Buffer.from([0x05, 0x00]), // Null Tag & Length
  ]);
  const varbindSeq = Buffer.concat([
    Buffer.from([0x30, varbind.length]), // Sequence Tag & Length
    varbind,
  ]);
  const varbindList = Buffer.concat([
    Buffer.from([0x30, varbindSeq.length]), // Varbind List Sequence
    varbindSeq,
  ]);

  // 2. Build GetRequest PDU
  // Request ID (4 bytes)
  const reqIdBuf = Buffer.alloc(4);
  reqIdBuf.writeInt32BE(requestId);
  const pduHeader = Buffer.concat([
    Buffer.from([0x02, 0x04]), // Integer Tag & Length 4
    reqIdBuf,
    Buffer.from([0x02, 0x01, 0x00]), // Error Status: 0
    Buffer.from([0x02, 0x01, 0x00]), // Error Index: 0
  ]);
  const pduBody = Buffer.concat([pduHeader, varbindList]);
  const pdu = Buffer.concat([
    Buffer.from([0xa0, pduBody.length]), // GetRequest Tag & Length
    pduBody,
  ]);

  // 3. Build SNMP Message (Version + Community + PDU)
  const version = Buffer.from([0x02, 0x01, 0x01]); // Version 1 (value 1 = v2c)
  const commStr = Buffer.from(community);
  const communityBuf = Buffer.concat([
    Buffer.from([0x04, commStr.length]), // Octet String Tag & Length
    commStr,
  ]);
  const messageBody = Buffer.concat([version, communityBuf, pdu]);
  
  return Buffer.concat([
    Buffer.from([0x30, messageBody.length]), // Sequence Tag & Length
    messageBody,
  ]);
}

/**
 * Sends a raw SNMP GET query over UDP and returns the parsed integer value
 */
export function querySnmpInt(
  host: string,
  community: string,
  oid: string,
  timeoutMs = 2000
): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const packet = buildSnmpGetPacket(community, oid);
    
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.close();
        resolve(null);
      }
    }, timeoutMs);

    socket.on('message', (msg) => {
      if (resolved) return;
      
      try {
        // Simple response parsing (locate the integer value at the end of the packet)
        // ASN.1 Integer tag is 0x02. Let's find it after the OID sequence.
        // For simplicity: loop from the end of the message to find the last tag
        let i = msg.length - 1;
        while (i > 0) {
          // If we find an Integer tag (0x02) and its length matches the remaining bytes
          if (msg[i - 2] === 0x02) {
            const len = msg[i - 1];
            if (i + len === msg.length) {
              let val = 0;
              for (let k = 0; k < len; k++) {
                val = (val << 8) + msg[i + k];
              }
              resolved = true;
              clearTimeout(timer);
              socket.close();
              resolve(val);
              return;
            }
          }
          i--;
        }
      } catch (err) {
        console.error('[SNMP Parser] Error:', err);
      }
      
      resolved = true;
      clearTimeout(timer);
      socket.close();
      resolve(null);
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.close();
        resolve(null);
      }
    });

    socket.send(packet, 0, packet.length, 161, host, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.close();
        resolve(null);
      }
    });
  });
}

/**
 * Queries CPU & Memory stats from a MikroTik Router using API fallback or SNMP
 */
export async function getRouterStats(router: any): Promise<DeviceStats> {
  // 1. Try RouterOS API first (most reliable and detailed)
  let apiConn: RouterOSAPI | null = null;
  try {
    const apiPort = router.port || router.apiPort || 8728;
    apiConn = new RouterOSAPI({
      host: router.ipAddress,
      user: router.username,
      password: router.password,
      port: apiPort,
      timeout: 10,
    });
    
    await apiConn.connect();
    apiConn.on('error', () => { /* ignore */ });

    const resource = await apiConn.write('/system/resource/print');
    if (resource && resource[0]) {
      const cpu = parseInt(resource[0]['cpu-load']);
      const totalMem = parseInt(resource[0]['total-memory']);
      const freeMem = parseInt(resource[0]['free-memory']);
      const memUsage = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : null;
      
      return {
        cpuUsage: isNaN(cpu) ? null : cpu,
        memoryUsage: memUsage,
      };
    }
  } catch (err: any) {
    console.warn(`[RouterStats] RouterOS API failed for ${router.name}: ${err.message}. Retrying via SNMP...`);
  } finally {
    if (apiConn) apiConn.close();
  }

  // 2. Fallback to SNMP
  try {
    const community = router.community || 'public';
    const cpu = await querySnmpInt(router.ipAddress, community, OIDS.mikrotikCpu);
    const totalMem = await querySnmpInt(router.ipAddress, community, OIDS.mikrotikTotalMemory);
    const freeMem = await querySnmpInt(router.ipAddress, community, OIDS.mikrotikFreeMemory);

    let memUsage: number | null = null;
    if (totalMem && freeMem) {
      memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
    }

    return { cpuUsage: cpu, memoryUsage: memUsage };
  } catch (err: any) {
    console.error(`[RouterStats] SNMP fallback failed for ${router.name}:`, err.message);
  }

  return { cpuUsage: null, memoryUsage: null };
}

/**
 * Queries CPU & Memory stats from a ZTE OLT using Telnet/SSH driver fallback or SNMP
 */
export async function getOltStats(olt: any): Promise<DeviceStats> {
  // 1. Try OLT CLI driver fallback (via existing show processor/memory commands)
  try {
    const stats = await withOlt(
      {
        host: olt.ipAddress,
        port: olt.port || 22,
        username: olt.username,
        password: olt.password,
        protocol: (olt.connection as any) || 'ssh',
        vendor: (olt.vendor as any) || 'zte',
      },
      async (driver) => {
        // If driver has a getPerformanceStats method, use it
        if (typeof (driver as any).getPerformanceStats === 'function') {
          return await (driver as any).getPerformanceStats();
        }
        
        // Custom command for ZTE
        if (olt.vendor === 'zte') {
          const cpuOut = await driver.exec('show processor');
          // Sample output: "CPU utilization in the past 5 seconds is 8%"
          const cpuMatch = cpuOut.output.match(/is\s+(\d+)%/i) || cpuOut.output.match(/(\d+)%/);
          const cpu = cpuMatch ? parseInt(cpuMatch[1]) : null;

          const memOut = await driver.exec('show memory');
          // Sample output: "Memory Size is 512M, Used 256M" or similar
          const memMatch = memOut.output.match(/usage:\s*(\d+)%/i) || memOut.output.match(/used\s+(\d+)/i);
          // Simple estimation: if usage % is direct, return it, else fallback
          const mem = memMatch ? parseInt(memMatch[1]) : null;
          
          return { cpuUsage: cpu, memoryUsage: mem };
        }
        return { cpuUsage: null, memoryUsage: null };
      }
    );
    if (stats.cpuUsage !== null || stats.memoryUsage !== null) {
      return stats;
    }
  } catch (err: any) {
    console.warn(`[OltStats] CLI Driver failed for OLT ${olt.name}: ${err.message}. Retrying via SNMP...`);
  }

  // 2. Fallback to SNMP generic sysUpTime/CPU queries
  try {
    const community = olt.community || 'public';
    // ZTE CPU Load OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.0
    const cpu = await querySnmpInt(olt.ipAddress, community, '1.3.6.1.4.1.3902.1082.500.10.2.3.0');
    return { cpuUsage: cpu, memoryUsage: null };
  } catch (err: any) {
    console.error(`[OltStats] SNMP failed for OLT ${olt.name}:`, err.message);
  }

  return { cpuUsage: null, memoryUsage: null };
}
