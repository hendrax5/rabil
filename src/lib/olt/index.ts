/**
 * OLT Driver Factory
 * Creates the appropriate driver based on vendor type
 */

import { ZTEDriver } from './zte';
import { HuaweiDriver } from './huawei';
import type { OltDriver, OltConnStr } from './types';

export * from './types';
export { ZTEDriver } from './zte';
export { HuaweiDriver } from './huawei';

/**
 * Factory function — returns the correct OLT driver for the vendor
 */
export function createOltDriver(config: {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: 'ssh' | 'telnet';
  vendor?: string;
}): OltDriver {
  const connStr: OltConnStr = {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    protocol: config.protocol || 'ssh',
    readyTimeout: 12000,
  };

  const vendor = (config.vendor || 'zte').toLowerCase();

  if (vendor === 'huawei') {
    return new HuaweiDriver(connStr);
  } else {
    // Default: ZTE (also handles 'vsol' which uses ZTE-compatible CLI)
    return new ZTEDriver(connStr);
  }
}

/**
 * Execute a function with an OLT driver, auto-connecting and disconnecting
 */
export async function withOlt<T>(
  config: Parameters<typeof createOltDriver>[0],
  fn: (driver: OltDriver) => Promise<T>
): Promise<T> {
  const driver = createOltDriver(config);
  try {
    await driver.connect();
    return await fn(driver);
  } finally {
    await driver.disconnect();
  }
}
